import { PDF_ORDER_JSON_SCHEMA, parsePdfOrderExtraction, type PdfOrderExtraction } from "@/lib/orders/pdf-order-schema";

export const MAX_ORDER_DOCUMENT_SIZE = 3 * 1024 * 1024;
export const ORDER_DOCUMENT_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const orderDocumentImageTypes = new Set<string>(ORDER_DOCUMENT_IMAGE_TYPES);

export class PdfOrderImportError extends Error {
  constructor(readonly code: "invalid_file" | "openai_unavailable" | "extraction_failed", message: string) {
    super(message);
  }
}

type Fetcher = typeof fetch;

export async function extractPdfOrder(file: File, fetcher: Fetcher = fetch): Promise<PdfOrderExtraction> {
  const isPdf = file.type === "application/pdf";
  const isImage = orderDocumentImageTypes.has(file.type);
  if (!isPdf && !isImage) {
    throw new PdfOrderImportError("invalid_file", "Le document doit être un PDF ou une photo JPG, PNG ou WebP.");
  }
  if (file.size > MAX_ORDER_DOCUMENT_SIZE) {
    throw new PdfOrderImportError("invalid_file", "Le document ne peut pas dépasser 3 Mo.");
  }
  if (process.env.APP_ENV === "test" && process.env.PDF_ORDER_E2E_MOCK) {
    return parsePdfOrderExtraction(JSON.parse(process.env.PDF_ORDER_E2E_MOCK));
  }
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new PdfOrderImportError("openai_unavailable", "L’extraction du document est indisponible pour le moment.");

  let fileId: string | null = null;
  try {
    const upload = new FormData();
    upload.set("purpose", isPdf ? "user_data" : "vision");
    upload.set("file", file);
    const uploadResponse = await fetcher("https://api.openai.com/v1/files", { method: "POST", headers: { Authorization: `Bearer ${apiKey}` }, body: upload });
    if (!uploadResponse.ok) throw new PdfOrderImportError("openai_unavailable", "L’extraction du document est indisponible pour le moment.");
    fileId = (await uploadResponse.json() as { id?: string }).id ?? null;
    if (!fileId) throw new PdfOrderImportError("extraction_failed", "Le document n’a pas pu être préparé.");

    const documentInput = isPdf
      ? { type: "input_file", file_id: fileId }
      : { type: "input_image", file_id: fileId, detail: "original" };
    const response = await fetcher("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_PDF_ORDER_MODEL ?? "gpt-5",
        store: false,
        instructions: "Extrais uniquement les champs demandés depuis ce document de commande. L’objet pharmacy DOIT décrire la pharmacie acheteuse, cliente ou destinataire qui passe ou reçoit la commande, jamais le fournisseur, le fabricant ou la marque. Les libellés comme Fournisseur désignent le fournisseur et ne doivent pas être utilisés comme pharmacie. Ne déduis jamais un CIP, un SIRET ou un FINESS à partir d’un numéro non identifié : renseigne ces identifiants uniquement lorsqu’ils sont explicitement libellés ou non ambigus. Pour orderDate, retourne le format YYYY-MM-DD. Si le champ Date de Commande est vide mais que le document comporte une date d’en-tête clairement imprimée, par exemple Le 31/08/2026, utilise cette date comme orderDate. Pour chaque ligne produit, quantity correspond à la quantité commandée et payante, par exemple Qté Cmde, et freeQuantity correspond aux unités gratuites, par exemple Qté UG, UG ou gratuité. Ne transforme jamais les unités gratuites en remise commerciale de 100 % : si une ligne contient uniquement des unités gratuites, mets quantity à null et freeQuantity au nombre correspondant. discountRate décrit uniquement une remise appliquée aux unités payantes. Ne déduis jamais un identifiant TR1, ne réalise aucun matching, conserve le nom de la pharmacie tel qu’imprimé et utilise null lorsqu’une valeur est absente ou illisible. Tous les éléments du tableau warnings DOIVENT être rédigés en français, de façon courte et compréhensible par un commercial.",
        input: [{ role: "user", content: [{ type: "input_text", text: "Extrais la commande sous forme de données structurées." }, documentInput] }],
        text: { format: { type: "json_schema", name: "pdf_order", strict: true, schema: PDF_ORDER_JSON_SCHEMA } },
      }),
    });
    if (!response.ok) throw new PdfOrderImportError("openai_unavailable", "L’extraction du document est indisponible pour le moment.");
    const payload = await response.json() as { output_text?: string; output?: Array<{ content?: Array<{ type?: string; text?: string }> }> };
    const outputText = payload.output_text ?? payload.output?.flatMap((item) => item.content ?? []).find((item) => item.type === "output_text")?.text;
    if (!outputText) throw new PdfOrderImportError("extraction_failed", "Le document ne contient pas de commande exploitable.");
    return parsePdfOrderExtraction(JSON.parse(outputText));
  } catch (error) {
    if (error instanceof PdfOrderImportError) throw error;
    throw new PdfOrderImportError("extraction_failed", "Le document ne contient pas de commande exploitable.");
  } finally {
    if (fileId) await fetcher(`https://api.openai.com/v1/files/${fileId}`, { method: "DELETE", headers: { Authorization: `Bearer ${apiKey}` } }).catch(() => undefined);
  }
}
