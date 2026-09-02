import { PDF_ORDER_JSON_SCHEMA, parsePdfOrderExtraction, type PdfOrderExtraction } from "@/lib/orders/pdf-order-schema";

export const MAX_PDF_ORDER_SIZE = 3 * 1024 * 1024;

export class PdfOrderImportError extends Error {
  constructor(readonly code: "invalid_file" | "openai_unavailable" | "extraction_failed", message: string) {
    super(message);
  }
}

type Fetcher = typeof fetch;

export async function extractPdfOrder(file: File, fetcher: Fetcher = fetch): Promise<PdfOrderExtraction> {
  if (file.type !== "application/pdf") throw new PdfOrderImportError("invalid_file", "Le document doit être un PDF.");
  if (file.size > MAX_PDF_ORDER_SIZE) throw new PdfOrderImportError("invalid_file", "Le PDF ne peut pas dépasser 3 Mo.");
  if (process.env.APP_ENV === "test" && process.env.PDF_ORDER_E2E_MOCK) {
    return parsePdfOrderExtraction(JSON.parse(process.env.PDF_ORDER_E2E_MOCK));
  }
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new PdfOrderImportError("openai_unavailable", "L’extraction PDF est indisponible pour le moment.");

  let fileId: string | null = null;
  try {
    const upload = new FormData();
    upload.set("purpose", "user_data");
    upload.set("file", file);
    const uploadResponse = await fetcher("https://api.openai.com/v1/files", { method: "POST", headers: { Authorization: `Bearer ${apiKey}` }, body: upload });
    if (!uploadResponse.ok) throw new PdfOrderImportError("openai_unavailable", "L’extraction PDF est indisponible pour le moment.");
    fileId = (await uploadResponse.json() as { id?: string }).id ?? null;
    if (!fileId) throw new PdfOrderImportError("extraction_failed", "Le PDF n’a pas pu être préparé.");

    const response = await fetcher("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_PDF_ORDER_MODEL ?? "gpt-5.6-luna",
        store: false,
        instructions: "Extract only the fields requested from this purchase-order PDF. Never infer a TR1 identifier, never match a product or pharmacy, and use null when a value is absent or unreadable.",
        input: [{ role: "user", content: [{ type: "input_text", text: "Extract the order as structured data." }, { type: "input_file", file_id: fileId }] }],
        text: { format: { type: "json_schema", name: "pdf_order", strict: true, schema: PDF_ORDER_JSON_SCHEMA } },
      }),
    });
    if (!response.ok) throw new PdfOrderImportError("openai_unavailable", "L’extraction PDF est indisponible pour le moment.");
    const payload = await response.json() as { output_text?: string; output?: Array<{ content?: Array<{ type?: string; text?: string }> }> };
    const outputText = payload.output_text ?? payload.output?.flatMap((item) => item.content ?? []).find((item) => item.type === "output_text")?.text;
    if (!outputText) throw new PdfOrderImportError("extraction_failed", "Le PDF ne contient pas de commande exploitable.");
    return parsePdfOrderExtraction(JSON.parse(outputText));
  } catch (error) {
    if (error instanceof PdfOrderImportError) throw error;
    throw new PdfOrderImportError("extraction_failed", "Le PDF ne contient pas de commande exploitable.");
  } finally {
    if (fileId) await fetcher(`https://api.openai.com/v1/files/${fileId}`, { method: "DELETE", headers: { Authorization: `Bearer ${apiKey}` } }).catch(() => undefined);
  }
}
