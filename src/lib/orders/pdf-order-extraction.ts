import { PDF_ORDER_JSON_SCHEMA, parsePdfOrderExtraction, type PdfOrderExtraction } from "@/lib/orders/pdf-order-schema";

export const MAX_ORDER_DOCUMENT_SIZE = 3 * 1024 * 1024;
export const ORDER_DOCUMENT_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const DEFAULT_ORDER_EXTRACTION_MODEL = "gpt-5-mini";
const orderDocumentImageTypes = new Set<string>(ORDER_DOCUMENT_IMAGE_TYPES);

const ORDER_EXTRACTION_INSTRUCTIONS = `
Tu extrais fidèlement un bon de commande pharmacie depuis un PDF ou une photo. N'invente aucune donnée et ne réalise aucun matching avec TR1.

PHARMACIE ACHETEUSE
- pharmacy décrit TOUJOURS la pharmacie cliente/acheteuse/destinataire, généralement dans le bloc d'identité du document.
- Un bloc libellé Fournisseur, Laboratoire, Marque ou Fabricant n'est JAMAIS la pharmacie. Ne mets donc jamais le nom du fournisseur dans pharmacy.
- Conserve le nom de la pharmacie tel qu'imprimé, même s'il contient des noms de titulaires.
- Extrais l'adresse et le code postal imprimés. Ne corrige pas un code postal en fonction de tes connaissances.
- Ne déduis jamais CIP, SIRET ou FINESS depuis un numéro non libellé. Renseigne ces identifiants uniquement lorsqu'ils sont explicitement identifiés ou non ambigus.

DATES
- orderDate est uniquement une vraie date de commande au format YYYY-MM-DD.
- Une Date de Livraison, Date d'Expédition, échéance ou autre date logistique ne doit jamais devenir orderDate.
- Renseigne deliveryDate séparément.
- orderDateSource = order_date pour un champ explicitement Date de Commande ; header_date pour une date d'en-tête clairement non logistique quand Date de Commande est vide ; delivery_date si la seule date candidate est une date de livraison ; other si la source est incertaine ; null si aucune date n'est lisible.
- Si Date de Commande est vide et que seule Date de Livraison est renseignée, mets orderDate=null, orderDateSource=delivery_date et renseigne deliveryDate.

LIGNES PRODUITS
- Lis le tableau ligne par ligne et respecte les colonnes imprimées.
- Une colonne Code contenant 8 à 14 chiffres, en particulier 13 chiffres, correspond à un code-barres/EAN : copie tous les chiffres exactement dans ean. Ne le mets pas dans sku.
- quantity = quantité commandée/payante, par exemple Qté Cmde.
- freeQuantity = unités gratuites, par exemple Qté UG, UG, Gratuité.
- Ignore une référence uniquement si quantity ET freeQuantity sont toutes deux absentes ou nulles. Une ligne avec 0 ou tiret n'est pas une quantité positive.
- Lorsqu'une ligne payante est immédiatement suivie d'une ligne du même produit avec une remise de 100 % et des UG, conserve les deux lectures du même EAN/libellé : la ligne UG doit avoir quantity=null et freeQuantity égal au nombre d'UG. Ne transforme jamais les UG en quantité payante.
- unitPriceHt doit représenter le prix unitaire HT AVANT remise lorsque le tableau fournit à la fois un prix d'achat/brut/tarif, une remise et un prix net. Exemple de colonnes : Prix Achat + Remise % + Prix Net => unitPriceHt=Prix Achat et discountRate=Remise %. Cela permet de recalculer le total de ligne.
- Si seul un prix net est visible et qu'aucun prix avant remise n'est disponible, utilise ce prix net comme unitPriceHt et mets discountRate=null afin de ne pas appliquer deux fois la remise.
- discountRate décrit uniquement la remise des unités payantes.
- taxRate = taux de TVA imprimé sur la ligne, par exemple 5,5 devient 5.5. Ne l'invente pas si la colonne n'est pas lisible.

TOTAUX ET TVA
- totalHt = total HT net du document.
- totalVat = montant total de TVA du récapitulatif fiscal s'il est visible.
- totalTtc = total TTC du document.
- Si un tableau récapitulatif TVA indique plusieurs taux, conserve taxRate par ligne lorsqu'il est lisible et totalVat comme somme totale affichée.

QUALITÉ
- Préserve les EAN, quantités, UG, remises, prix et taux de TVA avec une attention prioritaire : ce sont les champs utilisés pour le rapprochement automatique.
- Utilise null lorsqu'une valeur est absente ou illisible plutôt que de deviner.
- Tous les warnings doivent être courts, en français et compréhensibles par un commercial.
`;

export class PdfOrderImportError extends Error {
  constructor(readonly code: "invalid_file" | "openai_unavailable" | "extraction_failed", message: string) {
    super(message);
  }
}

type Fetcher = typeof fetch;

type OpenAIUsage = {
  input_tokens?: number;
  input_tokens_details?: {
    cached_tokens?: number;
  };
  output_tokens?: number;
  output_tokens_details?: {
    reasoning_tokens?: number;
  };
  total_tokens?: number;
};

export type OrderScanUsage = {
  model: string;
  inputTokens: number | null;
  cachedInputTokens: number | null;
  outputTokens: number | null;
  reasoningTokens: number | null;
  totalTokens: number | null;
  estimatedCostUsd: number | null;
  latencyMs: number;
  mimeType: string;
  fileSizeBytes: number;
};

type OrderScanUsageSink = (usage: OrderScanUsage) => void;

type ModelPricing = {
  input: number;
  cachedInput: number;
  output: number;
};

const MODEL_PRICING_PER_MILLION: Record<string, ModelPricing> = {
  "gpt-5": { input: 1.25, cachedInput: 0.125, output: 10 },
  "gpt-5-mini": { input: 0.25, cachedInput: 0.025, output: 2 },
  "gpt-5.6-luna": { input: 0.2, cachedInput: 0.02, output: 1.2 },
};

function getModelPricing(model: string): ModelPricing | null {
  const exact = MODEL_PRICING_PER_MILLION[model];
  if (exact) return exact;
  if (model.startsWith("gpt-5-mini-")) return MODEL_PRICING_PER_MILLION["gpt-5-mini"];
  return null;
}

function validTokenCount(value: number | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

export function estimateOrderScanCostUsd(model: string, usage: OpenAIUsage | undefined): number | null {
  const pricing = getModelPricing(model);
  const inputTokens = validTokenCount(usage?.input_tokens);
  const outputTokens = validTokenCount(usage?.output_tokens);
  if (!pricing || inputTokens === null || outputTokens === null) return null;

  const cachedInputTokens = Math.min(validTokenCount(usage?.input_tokens_details?.cached_tokens) ?? 0, inputTokens);
  const uncachedInputTokens = inputTokens - cachedInputTokens;
  const cost = (
    uncachedInputTokens * pricing.input
    + cachedInputTokens * pricing.cachedInput
    + outputTokens * pricing.output
  ) / 1_000_000;
  return Math.round(cost * 1_000_000_000) / 1_000_000_000;
}

function getReasoningConfig(model: string): { effort: "minimal" | "none" } | undefined {
  if (model === "gpt-5" || model === "gpt-5-mini" || model.startsWith("gpt-5-mini-")) {
    return { effort: "minimal" };
  }
  if (model.startsWith("gpt-5.6-")) return { effort: "none" };
  return undefined;
}

function logOrderScanUsage(usage: OrderScanUsage) {
  console.info("[order_scan_usage]", usage);
}

export async function extractPdfOrder(
  file: File,
  fetcher: Fetcher = fetch,
  usageSink: OrderScanUsageSink = logOrderScanUsage,
): Promise<PdfOrderExtraction> {
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
  const apiKey = process.env.OPENAI_API_KEY ?? process.env.OPEN_API_PREVIEW_KEY;
  if (!apiKey) throw new PdfOrderImportError("openai_unavailable", "L’extraction du document est indisponible pour le moment.");

  const model = process.env.OPENAI_PDF_ORDER_MODEL ?? DEFAULT_ORDER_EXTRACTION_MODEL;
  const reasoning = getReasoningConfig(model);
  const startedAt = Date.now();

  try {
    const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    const documentInput = isPdf
      ? { type: "input_file", filename: file.name || "commande.pdf", file_data: base64 }
      : { type: "input_image", image_url: `data:${file.type};base64,${base64}`, detail: "high" };

    const response = await fetcher("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        ...(reasoning ? { reasoning } : {}),
        store: false,
        instructions: ORDER_EXTRACTION_INSTRUCTIONS,
        input: [{ role: "user", content: [{ type: "input_text", text: "Extrais cette commande sous forme de données structurées." }, documentInput] }],
        text: { format: { type: "json_schema", name: "pdf_order", strict: true, schema: PDF_ORDER_JSON_SCHEMA } },
      }),
    });
    if (!response.ok) throw new PdfOrderImportError("openai_unavailable", "L’extraction du document est indisponible pour le moment.");
    const payload = await response.json() as {
      output_text?: string;
      output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
      usage?: OpenAIUsage;
    };

    usageSink({
      model,
      inputTokens: validTokenCount(payload.usage?.input_tokens),
      cachedInputTokens: validTokenCount(payload.usage?.input_tokens_details?.cached_tokens),
      outputTokens: validTokenCount(payload.usage?.output_tokens),
      reasoningTokens: validTokenCount(payload.usage?.output_tokens_details?.reasoning_tokens),
      totalTokens: validTokenCount(payload.usage?.total_tokens),
      estimatedCostUsd: estimateOrderScanCostUsd(model, payload.usage),
      latencyMs: Math.max(0, Date.now() - startedAt),
      mimeType: file.type,
      fileSizeBytes: file.size,
    });

    const outputText = payload.output_text ?? payload.output?.flatMap((item) => item.content ?? []).find((item) => item.type === "output_text")?.text;
    if (!outputText) throw new PdfOrderImportError("extraction_failed", "Le document ne contient pas de commande exploitable.");
    return parsePdfOrderExtraction(JSON.parse(outputText));
  } catch (error) {
    if (error instanceof PdfOrderImportError) throw error;
    throw new PdfOrderImportError("extraction_failed", "Le document ne contient pas de commande exploitable.");
  }
}
