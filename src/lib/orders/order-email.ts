import "server-only";

import { randomUUID } from "crypto";

export type EmailAttachment = {
  filename: string;
  contentType: string;
  data: Buffer;
};

export type Tr1OrderPdfData = {
  reference: string;
  orderDate: string | Date;
  brandName: string;
  brandCode?: string | null;
  brandOrderEmail?: string | null;
  commercialEmail?: string | null;
  pharmacy: {
    name: string;
    code?: string | null;
    legalName?: string | null;
    addressLine1?: string | null;
    addressLine2?: string | null;
    postalCode?: string | null;
    city?: string | null;
    email?: string | null;
    phone?: string | null;
    siret?: string | null;
    vatNumber?: string | null;
  };
  items: Array<{
    reference?: string | null;
    designation?: string | null;
    quantity: number;
    freeQuantity?: number | null;
    unitPriceHt?: number | string | null;
    discountRate?: number | string | null;
    netUnitPriceHt?: number | string | null;
    lineTotalHt?: number | string | null;
    taxRate?: number | string | null;
  }>;
  totals: {
    subtotalHt?: number | string | null;
    discountAmountHt?: number | string | null;
    netAmountHt?: number | string | null;
    taxAmount?: number | string | null;
    totalTtc?: number | string | null;
  };
  notes?: string | null;
};

function ascii(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "?");
}

function wrapLine(value: string, width = 92) {
  const words = ascii(value).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > width && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function pdfEscape(value: string) {
  return ascii(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function numberValue(value: number | string | null | undefined) {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: number | string | null | undefined) {
  return `${numberValue(value).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR`;
}

function percent(value: number | string | null | undefined) {
  return `${numberValue(value).toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} %`;
}

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 36;
const NAVY = [0.055, 0.114, 0.192] as const;
const ORANGE = [0.941, 0.475, 0.216] as const;
const CREAM = [0.973, 0.957, 0.918] as const;
const LIGHT = [0.965, 0.969, 0.973] as const;
const MID = [0.62, 0.64, 0.67] as const;
const DARK = [0.13, 0.15, 0.18] as const;
const BORDER = [0.84, 0.85, 0.87] as const;

type Color = readonly [number, number, number];

type PdfPage = {
  commands: string[];
};

function rgb(color: Color) {
  return `${color[0]} ${color[1]} ${color[2]}`;
}

function pdfTextWidth(value: string, size: number, bold = false) {
  return ascii(value).length * size * (bold ? 0.54 : 0.49);
}

function topY(top: number, height = 0) {
  return PAGE_HEIGHT - top - height;
}

function rect(page: PdfPage, x: number, top: number, width: number, height: number, fill: Color, stroke?: Color) {
  page.commands.push(`${rgb(fill)} rg`);
  if (stroke) page.commands.push(`${rgb(stroke)} RG 0.7 w`);
  page.commands.push(`${x} ${topY(top, height)} ${width} ${height} re ${stroke ? "B" : "f"}`);
}

function line(page: PdfPage, x1: number, top1: number, x2: number, top2: number, color: Color = BORDER, width = 0.7) {
  page.commands.push(`${rgb(color)} RG ${width} w ${x1} ${topY(top1)} m ${x2} ${topY(top2)} l S`);
}

function text(
  page: PdfPage,
  value: string,
  x: number,
  top: number,
  size = 9,
  options: { bold?: boolean; color?: Color; align?: "left" | "right" | "center"; width?: number } = {},
) {
  const clean = pdfEscape(value);
  const bold = Boolean(options.bold);
  const color = options.color ?? DARK;
  let drawX = x;
  if (options.width && options.align === "right") drawX = x + options.width - pdfTextWidth(clean, size, bold);
  if (options.width && options.align === "center") drawX = x + (options.width - pdfTextWidth(clean, size, bold)) / 2;
  page.commands.push(`BT /${bold ? "F2" : "F1"} ${size} Tf ${rgb(color)} rg ${drawX.toFixed(2)} ${topY(top, size).toFixed(2)} Td (${clean}) Tj ET`);
}

function wrappedText(
  page: PdfPage,
  value: string,
  x: number,
  top: number,
  maxChars: number,
  size = 8,
  options: { bold?: boolean; color?: Color; maxLines?: number; lineHeight?: number } = {},
) {
  const lines = wrapLine(value || "-", maxChars).slice(0, options.maxLines ?? 3);
  const lineHeight = options.lineHeight ?? size + 2;
  lines.forEach((entry, index) => text(page, entry, x, top + index * lineHeight, size, options));
  return lines.length * lineHeight;
}

function buildPdfPages(pages: PdfPage[]) {
  const objectCount = 4 + pages.length * 2;
  const objects = new Map<number, string>();
  const pageRefs: string[] = [];

  objects.set(1, "<< /Type /Catalog /Pages 2 0 R >>");
  objects.set(3, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  objects.set(4, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");

  pages.forEach((page, index) => {
    const pageObject = 5 + index * 2;
    const contentObject = pageObject + 1;
    pageRefs.push(`${pageObject} 0 R`);
    const content = page.commands.join("\n");
    const contentLength = Buffer.byteLength(content, "latin1");
    objects.set(
      pageObject,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObject} 0 R >>`,
    );
    objects.set(contentObject, `<< /Length ${contentLength} >>\nstream\n${content}\nendstream`);
  });

  objects.set(2, `<< /Type /Pages /Kids [${pageRefs.join(" ")}] /Count ${pageRefs.length} >>`);

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let objectNumber = 1; objectNumber <= objectCount; objectNumber += 1) {
    offsets[objectNumber] = Buffer.byteLength(pdf, "latin1");
    pdf += `${objectNumber} 0 obj\n${objects.get(objectNumber)}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objectCount + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let objectNumber = 1; objectNumber <= objectCount; objectNumber += 1) {
    pdf += `${String(offsets[objectNumber]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objectCount + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, "latin1");
}

function drawBrandHeader(page: PdfPage, input: Tr1OrderPdfData, compact = false) {
  rect(page, 0, 0, PAGE_WIDTH, compact ? 66 : 86, CREAM);
  rect(page, MARGIN, compact ? 19 : 23, 12, 12, ORANGE);
  text(page, "TR1", MARGIN + 20, compact ? 15 : 19, compact ? 15 : 18, { bold: true, color: NAVY });
  text(page, "PHARMA", MARGIN + 53, compact ? 17 : 21, compact ? 9 : 10, { bold: true, color: NAVY });
  text(page, "Cockpit d'execution commerciale terrain", MARGIN + 20, compact ? 36 : 43, 7.5, { color: MID });

  text(page, "MARQUE CONCERNEE", 345, compact ? 15 : 20, 7.5, { bold: true, color: MID, align: "right", width: 214 });
  text(page, input.brandName.toUpperCase(), 345, compact ? 30 : 36, compact ? 10 : 11, { bold: true, color: NAVY, align: "right", width: 214 });
  if (!compact && input.brandOrderEmail) text(page, input.brandOrderEmail, 345, 53, 7.5, { color: MID, align: "right", width: 214 });
}

function drawFooter(page: PdfPage, reference: string, pageNumber: number, pageCount: number) {
  line(page, MARGIN, 804, PAGE_WIDTH - MARGIN, 804, BORDER, 0.6);
  text(page, "Document genere par TR1 Pharma", MARGIN, 813, 6.7, { color: MID });
  text(page, `BON DE COMMANDE ${reference} - page ${pageNumber} / ${pageCount}`, 245, 813, 6.7, { color: MID, align: "right", width: PAGE_WIDTH - MARGIN - 245 });
}

function drawOrderTitle(page: PdfPage, input: Tr1OrderPdfData, top: number) {
  rect(page, MARGIN, top, PAGE_WIDTH - MARGIN * 2, 42, NAVY);
  text(page, `BON DE COMMANDE N° ${input.reference}`, MARGIN + 16, top + 10, 15, { bold: true, color: [1, 1, 1] });
  const date = new Date(input.orderDate).toLocaleDateString("fr-FR");
  text(page, `Date : ${date}`, PAGE_WIDTH - MARGIN - 150, top + 13, 9, { bold: true, color: [1, 1, 1], align: "right", width: 134 });
}

function drawInfoCards(page: PdfPage, input: Tr1OrderPdfData, top: number) {
  const leftWidth = 318;
  const gap = 12;
  const rightX = MARGIN + leftWidth + gap;
  const rightWidth = PAGE_WIDTH - MARGIN - rightX;
  const height = 128;
  rect(page, MARGIN, top, leftWidth, height, [1, 1, 1], BORDER);
  rect(page, rightX, top, rightWidth, height, [1, 1, 1], BORDER);

  text(page, "CLIENT", MARGIN + 12, top + 12, 7.5, { bold: true, color: MID });
  text(page, input.pharmacy.name.toUpperCase(), MARGIN + 12, top + 28, 10.5, { bold: true, color: NAVY });
  let y = top + 47;
  if (input.pharmacy.code) { text(page, `Code : ${input.pharmacy.code}`, MARGIN + 12, y, 8); y += 13; }
  if (input.pharmacy.addressLine1) { text(page, input.pharmacy.addressLine1, MARGIN + 12, y, 8); y += 12; }
  if (input.pharmacy.addressLine2) { text(page, input.pharmacy.addressLine2, MARGIN + 12, y, 8); y += 12; }
  const cityLine = [input.pharmacy.postalCode, input.pharmacy.city].filter(Boolean).join(" ");
  if (cityLine) { text(page, cityLine, MARGIN + 12, y, 8); y += 12; }
  if (input.pharmacy.email) { text(page, `Email : ${input.pharmacy.email}`, MARGIN + 12, y, 7.5); y += 12; }
  if (input.pharmacy.vatNumber) text(page, `TVA : ${input.pharmacy.vatNumber}`, MARGIN + 12, y, 7.5, { color: MID });

  text(page, "COMMANDE", rightX + 12, top + 12, 7.5, { bold: true, color: MID });
  text(page, input.brandName.toUpperCase(), rightX + 12, top + 29, 10, { bold: true, color: NAVY });
  if (input.brandCode) text(page, `Code marque : ${input.brandCode}`, rightX + 12, top + 47, 7.5, { color: MID });
  text(page, "Commercial", rightX + 12, top + 69, 7.5, { bold: true, color: MID });
  wrappedText(page, input.commercialEmail || "-", rightX + 12, top + 83, 31, 7.5, { maxLines: 2 });
  if (input.pharmacy.siret) text(page, `SIRET client : ${input.pharmacy.siret}`, rightX + 12, top + 107, 7, { color: MID });
}

type DisplayRow = {
  number: string;
  reference: string;
  designation: string;
  quantity: string;
  unitPrice: string;
  discount: string;
  netUnitPrice: string;
  total: string;
  offered: boolean;
};

function buildDisplayRows(items: Tr1OrderPdfData["items"]) {
  const rows: DisplayRow[] = [];
  items.forEach((item, index) => {
    rows.push({
      number: String(index + 1),
      reference: item.reference || "-",
      designation: item.designation || "Produit",
      quantity: String(item.quantity || 0),
      unitPrice: money(item.unitPriceHt),
      discount: percent(item.discountRate),
      netUnitPrice: money(item.netUnitPriceHt ?? numberValue(item.unitPriceHt) * (1 - numberValue(item.discountRate) / 100)),
      total: money(item.lineTotalHt),
      offered: false,
    });
    if (numberValue(item.freeQuantity) > 0) {
      rows.push({
        number: "",
        reference: item.reference || "-",
        designation: `${item.designation || "Produit"} - UG offerte(s)`,
        quantity: String(numberValue(item.freeQuantity)),
        unitPrice: money(item.unitPriceHt),
        discount: "100 %",
        netUnitPrice: money(0),
        total: money(0),
        offered: true,
      });
    }
  });
  return rows;
}

const TABLE_COLUMNS = [
  { label: "N°", x: MARGIN, width: 24, align: "center" as const },
  { label: "Reference", x: MARGIN + 24, width: 70, align: "left" as const },
  { label: "Designation", x: MARGIN + 94, width: 145, align: "left" as const },
  { label: "Qte", x: MARGIN + 239, width: 34, align: "center" as const },
  { label: "PU HT", x: MARGIN + 273, width: 60, align: "right" as const },
  { label: "Remise", x: MARGIN + 333, width: 50, align: "right" as const },
  { label: "PU net", x: MARGIN + 383, width: 60, align: "right" as const },
  { label: "Total HT", x: MARGIN + 443, width: 70, align: "right" as const },
];

function drawTableHeader(page: PdfPage, top: number) {
  rect(page, MARGIN, top, 513, 28, NAVY);
  TABLE_COLUMNS.forEach((column) => {
    text(page, column.label, column.x + 5, top + 9, 7.5, { bold: true, color: [1, 1, 1], align: column.align, width: column.width - 10 });
  });
  return top + 28;
}

function drawTableRow(page: PdfPage, row: DisplayRow, top: number, stripe: boolean) {
  const height = row.offered ? 34 : 42;
  rect(page, MARGIN, top, 513, height, row.offered ? LIGHT : stripe ? [0.99, 0.99, 0.99] : [1, 1, 1]);
  line(page, MARGIN, top + height, MARGIN + 513, top + height, BORDER, 0.45);

  text(page, row.number, TABLE_COLUMNS[0].x + 5, top + 11, 8, { align: "center", width: TABLE_COLUMNS[0].width - 10, color: row.offered ? MID : DARK });
  wrappedText(page, row.reference, TABLE_COLUMNS[1].x + 5, top + 8, 15, 7.1, { maxLines: 2, color: row.offered ? MID : DARK });
  wrappedText(page, row.designation, TABLE_COLUMNS[2].x + 5, top + 7, 31, 7.2, { bold: !row.offered, maxLines: 3, lineHeight: 9, color: row.offered ? MID : DARK });
  text(page, row.quantity, TABLE_COLUMNS[3].x + 5, top + 11, 8, { align: "center", width: TABLE_COLUMNS[3].width - 10, color: row.offered ? MID : DARK });
  text(page, row.unitPrice, TABLE_COLUMNS[4].x + 3, top + 11, 7.2, { align: "right", width: TABLE_COLUMNS[4].width - 6, color: row.offered ? MID : DARK });
  text(page, row.discount, TABLE_COLUMNS[5].x + 3, top + 11, 7.2, { align: "right", width: TABLE_COLUMNS[5].width - 6, color: row.offered ? MID : DARK });
  text(page, row.netUnitPrice, TABLE_COLUMNS[6].x + 3, top + 11, 7.2, { align: "right", width: TABLE_COLUMNS[6].width - 6, color: row.offered ? MID : DARK });
  text(page, row.total, TABLE_COLUMNS[7].x + 3, top + 11, 7.2, { bold: !row.offered, align: "right", width: TABLE_COLUMNS[7].width - 6, color: row.offered ? MID : NAVY });
  return top + height;
}

function drawTotals(page: PdfPage, input: Tr1OrderPdfData, top: number) {
  const x = 318;
  const width = PAGE_WIDTH - MARGIN - x;
  const rowHeight = 23;
  const labelWidth = 135;
  const rows = [
    ["Sous-total HT", money(input.totals.subtotalHt)],
    ["Remises", `- ${money(input.totals.discountAmountHt)}`],
    ["Net HT", money(input.totals.netAmountHt)],
    ["Total TVA", money(input.totals.taxAmount)],
  ];
  rows.forEach(([label, value], index) => {
    line(page, x, top + index * rowHeight + rowHeight, x + width, top + index * rowHeight + rowHeight, BORDER, 0.45);
    text(page, label, x + 8, top + index * rowHeight + 7, 8, { color: MID, align: "right", width: labelWidth });
    text(page, value, x + labelWidth + 18, top + index * rowHeight + 7, 8.5, { bold: index >= 2, color: DARK, align: "right", width: width - labelWidth - 26 });
  });
  const totalTop = top + rows.length * rowHeight + 7;
  rect(page, x, totalTop, width, 38, NAVY);
  text(page, "TOTAL TTC", x + 12, totalTop + 11, 11, { bold: true, color: [1, 1, 1], align: "right", width: labelWidth - 4 });
  text(page, money(input.totals.totalTtc), x + labelWidth + 18, totalTop + 10, 12, { bold: true, color: [1, 1, 1], align: "right", width: width - labelWidth - 26 });
  return totalTop + 38;
}

function drawSummary(page: PdfPage, input: Tr1OrderPdfData, top: number) {
  const quantity = input.items.reduce((sum, item) => sum + numberValue(item.quantity), 0);
  const free = input.items.reduce((sum, item) => sum + numberValue(item.freeQuantity), 0);
  const width = 250;
  rect(page, MARGIN, top, width, 83, [1, 1, 1], BORDER);
  const rows = [
    ["Nombre de lignes", String(input.items.length)],
    ["Quantite de produits factures", String(quantity)],
    ["Quantite d'UG offertes", String(free)],
  ];
  rows.forEach(([label, value], index) => {
    if (index) line(page, MARGIN, top + index * 27.5, MARGIN + width, top + index * 27.5, BORDER, 0.45);
    text(page, label, MARGIN + 10, top + 9 + index * 27.5, 7.7, { color: MID });
    text(page, value, MARGIN + 190, top + 9 + index * 27.5, 8, { bold: true, color: DARK, align: "right", width: 48 });
  });
}

export function buildTr1OrderPdf(input: Tr1OrderPdfData) {
  const rows = buildDisplayRows(input.items);
  const pages: PdfPage[] = [{ commands: [] }];
  let page = pages[0];
  drawBrandHeader(page, input);
  drawOrderTitle(page, input, 102);
  drawInfoCards(page, input, 160);
  let cursor = drawTableHeader(page, 306);
  let stripe = false;

  rows.forEach((row) => {
    const rowHeight = row.offered ? 34 : 42;
    if (cursor + rowHeight > 650) {
      page = { commands: [] };
      pages.push(page);
      drawBrandHeader(page, input, true);
      drawOrderTitle(page, input, 78);
      cursor = drawTableHeader(page, 132);
      stripe = false;
    }
    cursor = drawTableRow(page, row, cursor, stripe);
    if (!row.offered) stripe = !stripe;
  });

  if (cursor + 155 > 782) {
    page = { commands: [] };
    pages.push(page);
    drawBrandHeader(page, input, true);
    drawOrderTitle(page, input, 78);
    cursor = 148;
  } else {
    cursor += 18;
  }

  drawSummary(page, input, cursor);
  const totalsEnd = drawTotals(page, input, cursor);
  if (input.notes) {
    const notesTop = Math.max(cursor + 96, totalsEnd + 16);
    if (notesTop < 770) {
      text(page, "Notes", MARGIN, notesTop, 7.5, { bold: true, color: MID });
      wrappedText(page, input.notes, MARGIN, notesTop + 14, 92, 7.2, { maxLines: 3, color: DARK });
    }
  }

  pages.forEach((currentPage, index) => drawFooter(currentPage, input.reference, index + 1, pages.length));
  return buildPdfPages(pages);
}

export function buildSimpleOrderPdf(lines: string[]) {
  const wrapped = lines.flatMap((line) => wrapLine(line));
  const pageLines: string[][] = [];
  for (let index = 0; index < wrapped.length; index += 44) pageLines.push(wrapped.slice(index, index + 44));
  if (!pageLines.length) pageLines.push(["Commande TR1 Pharma"]);

  const pages: PdfPage[] = pageLines.map((pageLinesForPdf) => {
    const page: PdfPage = { commands: [] };
    page.commands.push("BT", "/F1 10 Tf", "50 795 Td", "14 TL");
    pageLinesForPdf.forEach((entry, index) => {
      page.commands.push(`(${pdfEscape(entry)}) Tj`);
      if (index !== pageLinesForPdf.length - 1) page.commands.push("T*");
    });
    page.commands.push("ET");
    return page;
  });
  return buildPdfPages(pages);
}

function encodedHeader(value: string) {
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

function foldBase64(buffer: Buffer) {
  return buffer.toString("base64").match(/.{1,76}/g)?.join("\r\n") ?? "";
}

export function buildMimeMessage(input: {
  from: string;
  to: string;
  subject: string;
  body: string;
  attachments: EmailAttachment[];
}) {
  const boundary = `tr1-${randomUUID()}`;
  const headers = [
    `From: ${input.from}`,
    `To: ${input.to}`,
    `Subject: ${encodedHeader(input.subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary=\"${boundary}\"`,
  ];
  const parts = [
    `--${boundary}\r\nContent-Type: text/plain; charset=\"UTF-8\"\r\nContent-Transfer-Encoding: base64\r\n\r\n${foldBase64(Buffer.from(input.body, "utf8"))}`,
    ...input.attachments.map((attachment) =>
      `--${boundary}\r\nContent-Type: ${attachment.contentType}; name=\"${ascii(attachment.filename).replace(/\"/g, "")}\"\r\nContent-Disposition: attachment; filename=\"${ascii(attachment.filename).replace(/\"/g, "")}\"\r\nContent-Transfer-Encoding: base64\r\n\r\n${foldBase64(attachment.data)}`,
    ),
    `--${boundary}--`,
  ];
  return `${headers.join("\r\n")}\r\n\r\n${parts.join("\r\n")}`;
}
