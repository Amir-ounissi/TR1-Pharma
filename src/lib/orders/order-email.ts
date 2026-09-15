import "server-only";

import { randomUUID } from "crypto";
import { readFileSync } from "fs";
import path from "path";
import { deflateSync, inflateSync } from "zlib";

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
    ean?: string | null;
    designation?: string | null;
    quantity: number;
    freeQuantity?: number | null;
    unitPriceHt?: number | string | null;
    discountRate?: number | string | null;
    netUnitPriceHt?: number | string | null;
    lineTotalHt?: number | string | null;
    taxRate?: number | string | null;
    unitsPerCase?: number | null;
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

function fileSafeAscii(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "?");
}

function printable(value: string) {
  return value
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/[\u00A0\u202F]/g, " ")
    .replace(/œ/g, "oe")
    .replace(/Œ/g, "OE")
    .replace(/…/g, "...")
    .replace(/[^\x20-\x7E\u00A0-\u00FF€]/g, "?");
}

function wrapLine(value: string, width = 92) {
  const words = printable(value).split(/\s+/).filter(Boolean);
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
  return printable(value)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/€/g, "\\200");
}

function numberValue(value: number | string | null | undefined) {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function cleanZero(value: number) {
  return Math.abs(value) < 0.005 ? 0 : value;
}

function money(value: number | string | null | undefined) {
  const amount = cleanZero(numberValue(value));
  return `${amount.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\u202f/g, " ")} €`;
}

function percent(value: number | string | null | undefined) {
  return `${cleanZero(numberValue(value)).toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} %`;
}

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 32;
const NAVY = [14 / 255, 29 / 255, 49 / 255] as const;
const NAVY_SOFT = [22 / 255, 42 / 255, 69 / 255] as const;
const ORANGE = [234 / 255, 112 / 255, 21 / 255] as const;
const IVORY = [244 / 255, 240 / 255, 231 / 255] as const;
const CARD = [1, 253 / 255, 248 / 255] as const;
const LIGHT = [248 / 255, 246 / 255, 241 / 255] as const;
const MID = [105 / 255, 113 / 255, 125 / 255] as const;
const DARK = NAVY;
const BORDER = [216 / 255, 209 / 255, 198 / 255] as const;

type Color = readonly [number, number, number];

type PdfPage = {
  commands: string[];
};

type PdfImage = {
  width: number;
  height: number;
  data: Buffer;
};

let cachedLogo: PdfImage | null | undefined;

function paeth(a: number, b: number, c: number) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function loadOfficialLogo(): PdfImage | null {
  if (cachedLogo !== undefined) return cachedLogo;
  try {
    const source = readFileSync(path.join(process.cwd(), "public", "brand", "tr1-wordmark-rgba.png"));
    const signature = "89504e470d0a1a0a";
    if (source.subarray(0, 8).toString("hex") !== signature) throw new Error("Invalid PNG");

    let offset = 8;
    let width = 0;
    let height = 0;
    let bitDepth = 0;
    let colorType = 0;
    const idat: Buffer[] = [];

    while (offset + 12 <= source.length) {
      const length = source.readUInt32BE(offset);
      const type = source.toString("ascii", offset + 4, offset + 8);
      const data = source.subarray(offset + 8, offset + 8 + length);
      if (type === "IHDR") {
        width = data.readUInt32BE(0);
        height = data.readUInt32BE(4);
        bitDepth = data[8];
        colorType = data[9];
      } else if (type === "IDAT") {
        idat.push(data);
      } else if (type === "IEND") {
        break;
      }
      offset += 12 + length;
    }

    if (!width || !height || bitDepth !== 8 || ![2, 6].includes(colorType)) throw new Error("Unsupported PNG");
    const bytesPerPixel = colorType === 6 ? 4 : 3;
    const stride = width * bytesPerPixel;
    const inflated = inflateSync(Buffer.concat(idat));
    const decoded = Buffer.alloc(height * stride);
    let readOffset = 0;

    for (let y = 0; y < height; y += 1) {
      const filter = inflated[readOffset];
      readOffset += 1;
      const rowOffset = y * stride;
      for (let x = 0; x < stride; x += 1) {
        const raw = inflated[readOffset + x];
        const left = x >= bytesPerPixel ? decoded[rowOffset + x - bytesPerPixel] : 0;
        const up = y > 0 ? decoded[rowOffset - stride + x] : 0;
        const upLeft = y > 0 && x >= bytesPerPixel ? decoded[rowOffset - stride + x - bytesPerPixel] : 0;
        let value = raw;
        if (filter === 1) value = (raw + left) & 255;
        else if (filter === 2) value = (raw + up) & 255;
        else if (filter === 3) value = (raw + Math.floor((left + up) / 2)) & 255;
        else if (filter === 4) value = (raw + paeth(left, up, upLeft)) & 255;
        else if (filter !== 0) throw new Error("Unsupported PNG filter");
        decoded[rowOffset + x] = value;
      }
      readOffset += stride;
    }

    const background = [255, 253, 248];
    const rgb = Buffer.alloc(width * height * 3);
    for (let pixel = 0; pixel < width * height; pixel += 1) {
      const sourceOffset = pixel * bytesPerPixel;
      const targetOffset = pixel * 3;
      const alpha = colorType === 6 ? decoded[sourceOffset + 3] / 255 : 1;
      for (let channel = 0; channel < 3; channel += 1) {
        rgb[targetOffset + channel] = Math.round(decoded[sourceOffset + channel] * alpha + background[channel] * (1 - alpha));
      }
    }

    cachedLogo = { width, height, data: deflateSync(rgb, { level: 9 }) };
    return cachedLogo;
  } catch {
    cachedLogo = null;
    return null;
  }
}

function rgb(color: Color) {
  return `${color[0]} ${color[1]} ${color[2]}`;
}

function pdfTextWidth(value: string, size: number, bold = false) {
  return printable(value).length * size * (bold ? 0.54 : 0.49);
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
  if (options.width && options.align === "right") drawX = x + options.width - pdfTextWidth(value, size, bold);
  if (options.width && options.align === "center") drawX = x + (options.width - pdfTextWidth(value, size, bold)) / 2;
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

function image(page: PdfPage, x: number, top: number, width: number, height: number) {
  page.commands.push(`q ${width.toFixed(2)} 0 0 ${height.toFixed(2)} ${x.toFixed(2)} ${topY(top, height).toFixed(2)} cm /ImLogo Do Q`);
}

function buildPdfPages(pages: PdfPage[], logo: PdfImage | null = null) {
  const objects = new Map<number, string>();
  const pageRefs: string[] = [];

  objects.set(1, "<< /Type /Catalog /Pages 2 0 R >>");
  objects.set(3, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  objects.set(4, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");

  let nextObject = 5;
  let logoObject: number | null = null;
  if (logo) {
    logoObject = nextObject;
    nextObject += 1;
    const binary = logo.data.toString("latin1");
    objects.set(
      logoObject,
      `<< /Type /XObject /Subtype /Image /Width ${logo.width} /Height ${logo.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length ${logo.data.length} >>\nstream\n${binary}\nendstream`,
    );
  }

  pages.forEach((page) => {
    const pageObject = nextObject;
    const contentObject = nextObject + 1;
    nextObject += 2;
    pageRefs.push(`${pageObject} 0 R`);
    const content = page.commands.join("\n");
    const contentLength = Buffer.byteLength(content, "latin1");
    const xObjects = logoObject ? ` /XObject << /ImLogo ${logoObject} 0 R >>` : "";
    objects.set(
      pageObject,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >>${xObjects} >> /Contents ${contentObject} 0 R >>`,
    );
    objects.set(contentObject, `<< /Length ${contentLength} >>\nstream\n${content}\nendstream`);
  });

  objects.set(2, `<< /Type /Pages /Kids [${pageRefs.join(" ")}] /Count ${pageRefs.length} >>`);
  const objectCount = nextObject - 1;

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

function drawBrandHeader(page: PdfPage, input: Tr1OrderPdfData, logo: PdfImage | null, compact = false) {
  const height = compact ? 58 : 76;
  rect(page, 0, 0, PAGE_WIDTH, height, CARD);
  if (logo) {
    const drawWidth = compact ? 92 : 116;
    const drawHeight = drawWidth * (logo.height / logo.width);
    image(page, MARGIN, compact ? 3 : 4, drawWidth, drawHeight);
  } else {
    text(page, "TR1 PHARMA", MARGIN, compact ? 18 : 24, compact ? 14 : 18, { bold: true, color: NAVY });
  }

  const labelTop = compact ? 13 : 18;
  text(page, "MARQUE CONCERNÉE", 342, labelTop, 7.1, { bold: true, color: MID, align: "right", width: 221 });
  text(page, input.brandName.toUpperCase(), 342, labelTop + 15, compact ? 9.5 : 10.5, { bold: true, color: NAVY, align: "right", width: 221 });
  if (!compact && input.brandOrderEmail) {
    text(page, input.brandOrderEmail, 342, labelTop + 31, 7, { color: MID, align: "right", width: 221 });
  }
  rect(page, 0, height - 3, PAGE_WIDTH, 3, ORANGE);
}

function drawFooter(page: PdfPage, reference: string, pageNumber: number, pageCount: number) {
  line(page, MARGIN, 808, PAGE_WIDTH - MARGIN, 808, BORDER, 0.6);
  text(page, "TR1 Pharma · Cockpit d'exécution commerciale terrain", MARGIN, 816, 6.5, { color: MID });
  text(page, `BON DE COMMANDE ${reference} · page ${pageNumber} / ${pageCount}`, 270, 816, 6.5, { color: MID, align: "right", width: PAGE_WIDTH - MARGIN - 270 });
}

function drawOrderTitle(page: PdfPage, input: Tr1OrderPdfData, top: number) {
  rect(page, MARGIN, top, PAGE_WIDTH - MARGIN * 2, 38, NAVY);
  rect(page, MARGIN, top, 5, 38, ORANGE);
  text(page, `BON DE COMMANDE N° ${input.reference}`, MARGIN + 16, top + 9, 14, { bold: true, color: [1, 1, 1] });
  const date = new Date(input.orderDate).toLocaleDateString("fr-FR");
  text(page, `Date : ${date}`, PAGE_WIDTH - MARGIN - 145, top + 12, 8.5, { bold: true, color: [1, 1, 1], align: "right", width: 130 });
}

function drawInfoCards(page: PdfPage, input: Tr1OrderPdfData, top: number) {
  const leftWidth = 326;
  const gap = 12;
  const rightX = MARGIN + leftWidth + gap;
  const rightWidth = PAGE_WIDTH - MARGIN - rightX;
  const height = 112;
  rect(page, MARGIN, top, leftWidth, height, CARD, BORDER);
  rect(page, rightX, top, rightWidth, height, CARD, BORDER);
  rect(page, MARGIN, top, 3, height, ORANGE);

  text(page, "CLIENT", MARGIN + 12, top + 10, 7, { bold: true, color: ORANGE });
  text(page, input.pharmacy.name.toUpperCase(), MARGIN + 12, top + 25, 10.2, { bold: true, color: NAVY });
  let y = top + 43;
  if (input.pharmacy.code) { text(page, `Code : ${input.pharmacy.code}`, MARGIN + 12, y, 7.4); y += 11; }
  if (input.pharmacy.addressLine1) { text(page, input.pharmacy.addressLine1, MARGIN + 12, y, 7.4); y += 11; }
  if (input.pharmacy.addressLine2) { text(page, input.pharmacy.addressLine2, MARGIN + 12, y, 7.4); y += 11; }
  const cityLine = [input.pharmacy.postalCode, input.pharmacy.city].filter(Boolean).join(" ");
  if (cityLine) { text(page, cityLine, MARGIN + 12, y, 7.4); y += 11; }
  if (input.pharmacy.email && y <= top + 95) { text(page, `Email : ${input.pharmacy.email}`, MARGIN + 12, y, 7); y += 11; }
  if (input.pharmacy.vatNumber && y <= top + 105) text(page, `TVA : ${input.pharmacy.vatNumber}`, MARGIN + 12, y, 7, { color: MID });

  text(page, "MARQUE CONCERNÉE", rightX + 12, top + 10, 7, { bold: true, color: ORANGE });
  text(page, input.brandName.toUpperCase(), rightX + 12, top + 27, 10, { bold: true, color: NAVY });
  if (input.brandCode) text(page, `Code : ${input.brandCode}`, rightX + 12, top + 44, 7.2, { color: MID });
  text(page, "Commercial", rightX + 12, top + 64, 7, { bold: true, color: MID });
  wrappedText(page, input.commercialEmail || "-", rightX + 12, top + 78, 27, 7.1, { maxLines: 2 });
  if (input.pharmacy.siret) text(page, `SIRET : ${input.pharmacy.siret}`, rightX + 12, top + 99, 6.6, { color: MID });
}

type DisplayRow = {
  number: string;
  reference: string;
  ean: string;
  designation: string;
  quantity: string;
  unitPrice: string;
  discount: string;
  netUnitPrice: string;
  total: string;
  taxRate: string;
  unitsPerCase: number | null;
  offered: boolean;
};

function buildDisplayRows(items: Tr1OrderPdfData["items"]) {
  return items.map((item, index) => {
    const main: DisplayRow = {
      number: String(index + 1),
      reference: item.reference || "-",
      ean: item.ean || "",
      designation: item.designation || "Produit",
      quantity: String(item.quantity || 0),
      unitPrice: money(item.unitPriceHt),
      discount: percent(item.discountRate),
      netUnitPrice: money(item.netUnitPriceHt ?? numberValue(item.unitPriceHt) * (1 - numberValue(item.discountRate) / 100)),
      total: money(item.lineTotalHt),
      taxRate: percent(item.taxRate),
      unitsPerCase: item.unitsPerCase ?? null,
      offered: false,
    };
    const offered = numberValue(item.freeQuantity) > 0 ? {
      number: "",
      reference: item.reference || "-",
      ean: "",
      designation: `${item.designation || "Produit"} - UG offerte(s)`,
      quantity: String(numberValue(item.freeQuantity)),
      unitPrice: money(item.unitPriceHt),
      discount: "100 %",
      netUnitPrice: money(0),
      total: money(0),
      taxRate: percent(item.taxRate),
      unitsPerCase: null,
      offered: true,
    } satisfies DisplayRow : null;
    return { main, offered };
  });
}

const TABLE_COLUMNS = [
  { label: "N°", x: MARGIN, width: 18, align: "center" as const },
  { label: "Code-barres", x: MARGIN + 18, width: 75, align: "left" as const },
  { label: "Référence", x: MARGIN + 93, width: 60, align: "left" as const },
  { label: "Désignation", x: MARGIN + 153, width: 122, align: "left" as const },
  { label: "Qté", x: MARGIN + 275, width: 30, align: "center" as const },
  { label: "PU HT", x: MARGIN + 305, width: 52, align: "right" as const },
  { label: "Remise", x: MARGIN + 357, width: 46, align: "right" as const },
  { label: "PU net", x: MARGIN + 403, width: 56, align: "right" as const },
  { label: "Total HT", x: MARGIN + 459, width: 72, align: "right" as const },
];

const EAN_L: Record<string, string> = {
  "0": "0001101", "1": "0011001", "2": "0010011", "3": "0111101", "4": "0100011",
  "5": "0110001", "6": "0101111", "7": "0111011", "8": "0110111", "9": "0001011",
};
const EAN_G: Record<string, string> = {
  "0": "0100111", "1": "0110011", "2": "0011011", "3": "0100001", "4": "0011101",
  "5": "0111001", "6": "0000101", "7": "0010001", "8": "0001001", "9": "0010111",
};
const EAN_R: Record<string, string> = {
  "0": "1110010", "1": "1100110", "2": "1101100", "3": "1000010", "4": "1011100",
  "5": "1001110", "6": "1010000", "7": "1000100", "8": "1001000", "9": "1110100",
};
const EAN_PARITY = ["LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG", "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL"];

function eanPattern(ean: string) {
  if (!/^\d{13}$/.test(ean)) return null;
  const first = Number(ean[0]);
  const parity = EAN_PARITY[first];
  let pattern = "101";
  for (let i = 1; i <= 6; i += 1) pattern += parity[i - 1] === "L" ? EAN_L[ean[i]] : EAN_G[ean[i]];
  pattern += "01010";
  for (let i = 7; i <= 12; i += 1) pattern += EAN_R[ean[i]];
  pattern += "101";
  return pattern;
}

function drawBarcode(page: PdfPage, ean: string, x: number, top: number, width: number, height: number) {
  const pattern = eanPattern(ean);
  if (!pattern) {
    if (ean) text(page, ean, x, top + 6, 6.1, { color: MID, align: "center", width });
    return;
  }
  const moduleWidth = width / pattern.length;
  for (let index = 0; index < pattern.length; index += 1) {
    if (pattern[index] === "1") rect(page, x + index * moduleWidth, top, Math.max(moduleWidth, 0.45), height, NAVY);
  }
  text(page, ean, x, top + height + 2, 5.1, { color: MID, align: "center", width });
}

function drawTableHeader(page: PdfPage, top: number) {
  rect(page, MARGIN, top, PAGE_WIDTH - MARGIN * 2, 25, NAVY);
  TABLE_COLUMNS.forEach((column) => {
    text(page, column.label, column.x + 3, top + 8, 6.6, { bold: true, color: [1, 1, 1], align: column.align, width: column.width - 6 });
  });
  return top + 25;
}

function drawTableRow(page: PdfPage, row: DisplayRow, top: number, stripe: boolean) {
  const height = row.offered ? 24 : 38;
  rect(page, MARGIN, top, PAGE_WIDTH - MARGIN * 2, height, row.offered ? IVORY : stripe ? LIGHT : [1, 1, 1]);
  line(page, MARGIN, top + height, PAGE_WIDTH - MARGIN, top + height, BORDER, 0.4);

  if (row.offered) {
    text(page, "UG", TABLE_COLUMNS[0].x + 2, top + 7, 6.2, { bold: true, color: ORANGE, align: "center", width: TABLE_COLUMNS[0].width - 4 });
    text(page, row.reference, TABLE_COLUMNS[2].x + 4, top + 7, 6.7, { color: MID });
    wrappedText(page, row.designation, TABLE_COLUMNS[3].x + 4, top + 6, 29, 6.7, { maxLines: 2, lineHeight: 8, color: MID });
  } else {
    text(page, row.number, TABLE_COLUMNS[0].x + 2, top + 12, 7.2, { align: "center", width: TABLE_COLUMNS[0].width - 4 });
    drawBarcode(page, row.ean, TABLE_COLUMNS[1].x + 6, top + 4, TABLE_COLUMNS[1].width - 12, 16);
    text(page, row.reference, TABLE_COLUMNS[2].x + 4, top + 10, 6.8);
    wrappedText(page, row.designation, TABLE_COLUMNS[3].x + 4, top + 5, 28, 6.9, { bold: true, maxLines: 2, lineHeight: 8 });
    const details = [row.unitsPerCase ? `PCB : ${row.unitsPerCase}` : null, `TVA ${row.taxRate}`].filter(Boolean).join(" · ");
    text(page, details, TABLE_COLUMNS[3].x + 4, top + 23, 5.8, { color: MID });
  }

  const numericColor = row.offered ? MID : DARK;
  text(page, row.quantity, TABLE_COLUMNS[4].x + 3, top + (row.offered ? 7 : 12), 7, { align: "center", width: TABLE_COLUMNS[4].width - 6, color: numericColor });
  text(page, row.unitPrice, TABLE_COLUMNS[5].x + 2, top + (row.offered ? 7 : 12), 6.6, { align: "right", width: TABLE_COLUMNS[5].width - 4, color: numericColor });
  text(page, row.discount, TABLE_COLUMNS[6].x + 2, top + (row.offered ? 7 : 12), 6.6, { align: "right", width: TABLE_COLUMNS[6].width - 4, color: numericColor });
  text(page, row.netUnitPrice, TABLE_COLUMNS[7].x + 2, top + (row.offered ? 7 : 12), 6.6, { align: "right", width: TABLE_COLUMNS[7].width - 4, color: numericColor });
  text(page, row.total, TABLE_COLUMNS[8].x + 2, top + (row.offered ? 7 : 12), 6.8, { bold: !row.offered, align: "right", width: TABLE_COLUMNS[8].width - 4, color: row.offered ? MID : NAVY });
  return top + height;
}

function drawTotals(page: PdfPage, input: Tr1OrderPdfData, top: number) {
  const x = 306;
  const width = PAGE_WIDTH - MARGIN - x;
  const rowHeight = 18;
  const labelWidth = 123;
  const discount = cleanZero(numberValue(input.totals.discountAmountHt));
  const rows = [
    ["Sous-total HT", money(input.totals.subtotalHt)],
    ["Remises", discount > 0 ? `- ${money(discount)}` : money(0)],
    ["Net HT", money(input.totals.netAmountHt)],
    ["Total TVA", money(input.totals.taxAmount)],
  ];
  rows.forEach(([label, value], index) => {
    line(page, x, top + index * rowHeight + rowHeight, x + width, top + index * rowHeight + rowHeight, BORDER, 0.4);
    text(page, label, x + 6, top + index * rowHeight + 5, 7.3, { color: MID, align: "right", width: labelWidth });
    text(page, value, x + labelWidth + 14, top + index * rowHeight + 5, 7.8, { bold: index >= 2, color: DARK, align: "right", width: width - labelWidth - 20 });
  });
  const totalTop = top + rows.length * rowHeight + 6;
  rect(page, x, totalTop, width, 34, NAVY);
  rect(page, x, totalTop, 4, 34, ORANGE);
  text(page, "TOTAL TTC", x + 10, totalTop + 10, 9.5, { bold: true, color: [1, 1, 1], align: "right", width: labelWidth - 2 });
  text(page, money(input.totals.totalTtc), x + labelWidth + 14, totalTop + 9, 10.5, { bold: true, color: [1, 1, 1], align: "right", width: width - labelWidth - 20 });
  return totalTop + 34;
}

function drawSummary(page: PdfPage, input: Tr1OrderPdfData, top: number) {
  const quantity = input.items.reduce((sum, item) => sum + numberValue(item.quantity), 0);
  const free = input.items.reduce((sum, item) => sum + numberValue(item.freeQuantity), 0);
  const width = 245;
  rect(page, MARGIN, top, width, 72, CARD, BORDER);
  const rows = [
    ["Nombre de lignes", String(input.items.length)],
    ["Quantité de produits facturés", String(quantity)],
    ["Quantité d'UG offertes", String(free)],
  ];
  rows.forEach(([label, value], index) => {
    if (index) line(page, MARGIN, top + index * 24, MARGIN + width, top + index * 24, BORDER, 0.4);
    text(page, label, MARGIN + 9, top + 7 + index * 24, 7.1, { color: MID });
    text(page, value, MARGIN + 188, top + 7 + index * 24, 7.7, { bold: true, color: DARK, align: "right", width: 45 });
  });
}

function drawContinuationHeader(page: PdfPage, input: Tr1OrderPdfData, logo: PdfImage | null) {
  drawBrandHeader(page, input, logo, true);
  drawOrderTitle(page, input, 70);
}

export function buildTr1OrderPdf(input: Tr1OrderPdfData) {
  const logo = loadOfficialLogo();
  const groups = buildDisplayRows(input.items);
  const pages: PdfPage[] = [{ commands: [] }];
  let page = pages[0];
  drawBrandHeader(page, input, logo);
  drawOrderTitle(page, input, 86);
  drawInfoCards(page, input, 136);
  let cursor = drawTableHeader(page, 260);
  let stripe = false;
  let tableBottomLimit = 665;

  groups.forEach((group) => {
    const blockHeight = 38 + (group.offered ? 24 : 0);
    if (cursor + blockHeight > tableBottomLimit) {
      page = { commands: [] };
      pages.push(page);
      drawContinuationHeader(page, input, logo);
      cursor = drawTableHeader(page, 120);
      stripe = false;
      tableBottomLimit = 690;
    }
    cursor = drawTableRow(page, group.main, cursor, stripe);
    if (group.offered) cursor = drawTableRow(page, group.offered, cursor, stripe);
    stripe = !stripe;
  });

  let summaryTop = cursor + 10;
  if (summaryTop + 112 > 800) {
    page = { commands: [] };
    pages.push(page);
    drawContinuationHeader(page, input, logo);
    summaryTop = 128;
  }

  drawSummary(page, input, summaryTop);
  const totalsEnd = drawTotals(page, input, summaryTop);
  if (input.notes) {
    const notesTop = Math.max(summaryTop + 80, totalsEnd + 8);
    if (notesTop < 795) {
      text(page, "Notes", MARGIN, notesTop, 6.8, { bold: true, color: ORANGE });
      wrappedText(page, input.notes, MARGIN, notesTop + 12, 64, 6.5, { maxLines: 2, color: MID });
    }
  }

  pages.forEach((currentPage, index) => drawFooter(currentPage, input.reference, index + 1, pages.length));
  return buildPdfPages(pages, logo);
}

export function buildSimpleOrderPdf(lines: string[]) {
  const wrapped = lines.flatMap((entry) => wrapLine(entry));
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
      `--${boundary}\r\nContent-Type: ${attachment.contentType}; name=\"${fileSafeAscii(attachment.filename).replace(/\"/g, "")}\"\r\nContent-Disposition: attachment; filename=\"${fileSafeAscii(attachment.filename).replace(/\"/g, "")}\"\r\nContent-Transfer-Encoding: base64\r\n\r\n${foldBase64(attachment.data)}`,
    ),
    `--${boundary}--`,
  ];
  return `${headers.join("\r\n")}\r\n\r\n${parts.join("\r\n")}`;
}
