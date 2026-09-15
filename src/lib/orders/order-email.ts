import "server-only";

import { randomUUID } from "crypto";

export type EmailAttachment = {
  filename: string;
  contentType: string;
  data: Buffer;
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
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

export function buildSimpleOrderPdf(lines: string[]) {
  const wrapped = lines.flatMap((line) => wrapLine(line));
  const pageLines: string[][] = [];
  for (let index = 0; index < wrapped.length; index += 44) {
    pageLines.push(wrapped.slice(index, index + 44));
  }
  if (!pageLines.length) pageLines.push(["Commande TR1 Pharma"]);

  const objectCount = 3 + pageLines.length * 2;
  const objects = new Map<number, string>();
  const pageRefs: string[] = [];

  objects.set(1, "<< /Type /Catalog /Pages 2 0 R >>");
  objects.set(3, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

  pageLines.forEach((page, index) => {
    const pageObject = 4 + index * 2;
    const contentObject = pageObject + 1;
    pageRefs.push(`${pageObject} 0 R`);
    const content = [
      "BT",
      "/F1 10 Tf",
      "50 795 Td",
      "14 TL",
      ...page.flatMap((line, lineIndex) => [
        `(${pdfEscape(line)}) Tj`,
        ...(lineIndex === page.length - 1 ? [] : ["T*"]),
      ]),
      "ET",
    ].join("\n");
    const contentLength = Buffer.byteLength(content, "latin1");
    objects.set(
      pageObject,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObject} 0 R >>`,
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
