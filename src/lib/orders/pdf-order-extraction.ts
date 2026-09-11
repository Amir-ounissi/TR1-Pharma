import { PDF_ORDER_JSON_SCHEMA, parsePdfOrderExtraction, type PdfOrderExtraction } from "@/lib/orders/pdf-order-schema";
import {
  assessPdfOrderExtraction,
  buildPdfOrderRepairPrompt,
  canonicalizePdfOrderExtraction,
} from "@/lib/orders/pdf-order-extraction-quality";

export const MAX_ORDER_DOCUMENT_SIZE = 3 * 1024 * 1024;
export const MAX_ORDER_SCAN_PAGES = 6;
export const MAX_ORDER_SCAN_TOTAL_SIZE = 12 * 1024 * 1024;
export const ORDER_DOCUMENT_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const DEFAULT_ORDER_EXTRACTION_MODEL = "gpt-5-mini";
export const DEFAULT_ORDER_REPAIR_MODEL = "gpt-5.6-terra";
const orderDocumentImageTypes = new Set<string>(ORDER_DOCUMENT_IMAGE_TYPES);

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const VERCEL_AI_GATEWAY_RESPONSES_URL = "https://ai-gateway.vercel.sh/v1/responses";

const ORDER_EXTRACTION_INSTRUCTIONS = `
Tu extrais fidèlement un bon de commande pharmacie depuis un PDF ou une ou plusieurs pages scannées. N'invente aucune donnée et ne réalise aucun matching avec TR1.
Si plusieurs images sont fournies, elles appartiennent toutes au même bon de commande et sont présentées dans l'ordre des pages. Analyse-les comme un seul document.

FORMAT ERP PHARMACIE FRÉQUENT
Beaucoup de documents traités ont un tableau proche de : Code / Désignation / Qté Cmde / Qté UG / Prix Achat / Remise % / Prix Net / TVA.
Quand tu reconnais ce type de tableau :
- respecte strictement les cellules de la même ligne physique ;
- ne prends JAMAIS le Code/EAN de la ligne suivante pour compléter une ligne où le code est vide ;
- une référence imprimée sans quantité commandée positive et sans UG positive n'est pas une ligne de commande ;
- une seconde ligne du même produit à 100 % correspond généralement aux UG : elle ne génère aucun CA HT ;
- Prix Achat + Remise % sert au recalcul du HT ; Prix Net est un contrôle, pas un second prix à appliquer ;
- le total HT imprimé en bas du document est un contrôle de cohérence. Relis les colonnes si le recalcul ne retombe pas dessus, sans jamais inventer ou modifier un chiffre pour forcer le résultat.

EXEMPLES MÉTIER À REPRODUIRE
Exemple 1, ligne payante puis gratuité :
- ligne imprimée : Produit A | Qté Cmde 12 | Prix Achat 33,08 | Remise 35 %
- ligne suivante : Produit A | Qté UG 2 | Remise 100 %
=> première ligne : quantity=12, freeQuantity=0, unitPriceHt=33.08, discountRate=35
=> seconde ligne : quantity=null, freeQuantity=2, unitPriceHt=33.08 si visible, discountRate=100
Les 2 UG ne sont jamais ajoutées à quantity.

Exemple 2, référence non commandée :
- ligne imprimée : Produit B | Code 3770000000000 | Qté Cmde vide | Qté UG vide | Prix Achat 20,00
=> ne crée aucune ligne produit pour cette référence.

Exemple 3, code absent sur une ligne :
- ligne Produit C sans Code/EAN, puis ligne Produit D avec Code 3770000000001
=> Produit C garde ean=null. Le code 3770000000001 appartient uniquement à Produit D.

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

QUALITÉ AVANT RÉPONSE
- Préserve les EAN, quantités, UG, remises, prix et taux de TVA avec une attention prioritaire : ce sont les champs utilisés pour le rapprochement automatique.
- Utilise null lorsqu'une valeur est absente ou illisible plutôt que de deviner.
- Avant de répondre, vérifie une seconde fois chaque ligne qui contribue au total HT.
- Recalcule le HT à partir de quantity × unitPriceHt × (1-remise). Les UG sont exclues du calcul.
- Vérifie aussi que totalHt + totalVat = totalTtc lorsque les trois montants sont présents.
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
  attempt: "initial" | "repair";
  inputTokens: number | null;
  cachedInputTokens: number | null;
  outputTokens: number | null;
  reasoningTokens: number | null;
  totalTokens: number | null;
  estimatedCostUsd: number | null;
  latencyMs: number;
  mimeType: string;
  fileSizeBytes: number;
  fileCount: number;
};

type OrderScanUsageSink = (usage: OrderScanUsage) => void;

type ModelPricing = {
  input: number;
  cachedInput: number;
  output: number;
};

type ExtractionProvider = {
  apiKey: string;
  endpoint: string;
  model: string;
  pricingModel: string;
  source: "openai" | "vercel_ai_gateway";
};

type ResponsesPayload = {
  output_text?: string;
  output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
  usage?: OpenAIUsage;
};

const MODEL_PRICING_PER_MILLION: Record<string, ModelPricing> = {
  "gpt-5": { input: 1.25, cachedInput: 0.125, output: 10 },
  "gpt-5-mini": { input: 0.25, cachedInput: 0.025, output: 2 },
  "gpt-5.6-luna": { input: 0.2, cachedInput: 0.02, output: 1.2 },
};

function getModelPricing(model: string): ModelPricing | null {
  const normalizedModel = model.startsWith("openai/") ? model.slice("openai/".length) : model;
  const exact = MODEL_PRICING_PER_MILLION[normalizedModel];
  if (exact) return exact;
  if (normalizedModel.startsWith("gpt-5-mini-")) return MODEL_PRICING_PER_MILLION["gpt-5-mini"];
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

function getReasoningConfig(
  model: string,
  attempt: "initial" | "repair",
): { effort: "minimal" | "none" | "medium" } | undefined {
  const normalizedModel = model.startsWith("openai/") ? model.slice("openai/".length) : model;
  if (normalizedModel === "gpt-5" || normalizedModel === "gpt-5-mini" || normalizedModel.startsWith("gpt-5-mini-")) {
    return { effort: "minimal" };
  }
  if (normalizedModel.startsWith("gpt-5.6-")) {
    return { effort: attempt === "repair" ? "medium" : "none" };
  }
  return undefined;
}

function resolveExtractionProvider(): ExtractionProvider | null {
  const requestedModel = process.env.OPENAI_PDF_ORDER_MODEL ?? DEFAULT_ORDER_EXTRACTION_MODEL;
  const directApiKey = process.env.OPENAI_API_KEY ?? process.env.OPEN_API_PREVIEW_KEY;
  if (directApiKey) {
    return {
      apiKey: directApiKey,
      endpoint: OPENAI_RESPONSES_URL,
      model: requestedModel,
      pricingModel: requestedModel,
      source: "openai",
    };
  }

  const gatewayApiKey = process.env.AI_GATEWAY_API_KEY ?? process.env.VERCEL_OIDC_TOKEN;
  if (gatewayApiKey) {
    const gatewayModel = requestedModel.includes("/") ? requestedModel : `openai/${requestedModel}`;
    return {
      apiKey: gatewayApiKey,
      endpoint: VERCEL_AI_GATEWAY_RESPONSES_URL,
      model: gatewayModel,
      pricingModel: requestedModel,
      source: "vercel_ai_gateway",
    };
  }

  return null;
}

function resolveRepairProvider(provider: ExtractionProvider): ExtractionProvider {
  const requestedModel = process.env.OPENAI_PDF_ORDER_REPAIR_MODEL ?? DEFAULT_ORDER_REPAIR_MODEL;
  const model = provider.source === "vercel_ai_gateway"
    ? requestedModel.includes("/") ? requestedModel : `openai/${requestedModel}`
    : requestedModel.startsWith("openai/") ? requestedModel.slice("openai/".length) : requestedModel;

  return {
    ...provider,
    model,
    pricingModel: requestedModel.startsWith("openai/") ? requestedModel.slice("openai/".length) : requestedModel,
  };
}

function logOrderScanUsage(usage: OrderScanUsage) {
  console.info("[order_scan_usage]", usage);
}

function validateOrderDocuments(files: File[]) {
  if (files.length === 0) {
    throw new PdfOrderImportError("invalid_file", "Ajoutez un scan de la commande ou un PDF.");
  }
  if (files.length > MAX_ORDER_SCAN_PAGES) {
    throw new PdfOrderImportError("invalid_file", `Le scan ne peut pas dépasser ${MAX_ORDER_SCAN_PAGES} pages.`);
  }

  const pdfCount = files.filter((file) => file.type === "application/pdf").length;
  if (pdfCount > 0 && files.length > 1) {
    throw new PdfOrderImportError("invalid_file", "Importez un seul PDF à la fois ou utilisez uniquement des pages scannées.");
  }

  let totalSize = 0;
  for (const file of files) {
    const isPdf = file.type === "application/pdf";
    const isImage = orderDocumentImageTypes.has(file.type);
    if (!isPdf && !isImage) {
      throw new PdfOrderImportError("invalid_file", "Le document doit être un PDF ou un scan JPG, PNG ou WebP.");
    }
    if (file.size > MAX_ORDER_DOCUMENT_SIZE) {
      throw new PdfOrderImportError("invalid_file", "Chaque page ou PDF ne peut pas dépasser 3 Mo.");
    }
    totalSize += file.size;
  }
  if (totalSize > MAX_ORDER_SCAN_TOTAL_SIZE) {
    throw new PdfOrderImportError("invalid_file", "Le scan complet ne peut pas dépasser 12 Mo.");
  }
}

async function toOpenAIDocumentInput(file: File) {
  const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
  if (file.type === "application/pdf") {
    return { type: "input_file", filename: file.name || "commande.pdf", file_data: `data:application/pdf;base64,${base64}` };
  }
  return { type: "input_image", image_url: `data:${file.type};base64,${base64}`, detail: "high" };
}

function outputTextFromPayload(payload: ResponsesPayload) {
  return payload.output_text
    ?? payload.output?.flatMap((item) => item.content ?? []).find((item) => item.type === "output_text")?.text;
}

async function requestStructuredExtraction(params: {
  provider: ExtractionProvider;
  documentInputs: Awaited<ReturnType<typeof toOpenAIDocumentInput>>[];
  files: File[];
  fetcher: Fetcher;
  usageSink: OrderScanUsageSink;
  attempt: "initial" | "repair";
  prompt: string;
}) {
  const { provider, documentInputs, files, fetcher, usageSink, attempt, prompt } = params;
  const reasoning = getReasoningConfig(provider.model, attempt);
  const startedAt = Date.now();
  const response = await fetcher(provider.endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${provider.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: provider.model,
      ...(reasoning ? { reasoning } : {}),
      store: false,
      instructions: ORDER_EXTRACTION_INSTRUCTIONS,
      input: [{
        role: "user",
        content: [
          { type: "input_text", text: prompt },
          ...documentInputs,
        ],
      }],
      text: { format: { type: "json_schema", name: "pdf_order", strict: true, schema: PDF_ORDER_JSON_SCHEMA } },
    }),
  });

  if (!response.ok) {
    const responseBody = await response.text().catch(() => "");
    console.error("[order_scan_error] Extraction provider rejected request", {
      provider: provider.source,
      model: provider.model,
      attempt,
      status: response.status,
      response: responseBody.slice(0, 800),
    });
    throw new PdfOrderImportError("openai_unavailable", "L’extraction du document est indisponible pour le moment.");
  }

  const payload = await response.json() as ResponsesPayload;
  usageSink({
    model: provider.model,
    attempt,
    inputTokens: validTokenCount(payload.usage?.input_tokens),
    cachedInputTokens: validTokenCount(payload.usage?.input_tokens_details?.cached_tokens),
    outputTokens: validTokenCount(payload.usage?.output_tokens),
    reasoningTokens: validTokenCount(payload.usage?.output_tokens_details?.reasoning_tokens),
    totalTokens: validTokenCount(payload.usage?.total_tokens),
    estimatedCostUsd: estimateOrderScanCostUsd(provider.pricingModel, payload.usage),
    latencyMs: Math.max(0, Date.now() - startedAt),
    mimeType: files.length === 1 ? files[0].type : "image/multipage",
    fileSizeBytes: files.reduce((total, file) => total + file.size, 0),
    fileCount: files.length,
  });

  const outputText = outputTextFromPayload(payload);
  if (!outputText) throw new PdfOrderImportError("extraction_failed", "Le document ne contient pas de commande exploitable.");
  return canonicalizePdfOrderExtraction(parsePdfOrderExtraction(JSON.parse(outputText)));
}

export async function extractOrderDocuments(
  files: File[],
  fetcher: Fetcher = fetch,
  usageSink: OrderScanUsageSink = logOrderScanUsage,
): Promise<PdfOrderExtraction> {
  validateOrderDocuments(files);
  if (process.env.APP_ENV === "test" && process.env.PDF_ORDER_E2E_MOCK) {
    return canonicalizePdfOrderExtraction(parsePdfOrderExtraction(JSON.parse(process.env.PDF_ORDER_E2E_MOCK)));
  }

  const provider = resolveExtractionProvider();
  if (!provider) {
    console.error("[order_scan_error] No extraction provider credential is configured", {
      hasOpenAIKey: Boolean(process.env.OPENAI_API_KEY || process.env.OPEN_API_PREVIEW_KEY),
      hasGatewayKey: Boolean(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN),
    });
    throw new PdfOrderImportError("openai_unavailable", "L’extraction du document est indisponible pour le moment.");
  }

  try {
    const documentInputs = await Promise.all(files.map(toOpenAIDocumentInput));
    const initial = await requestStructuredExtraction({
      provider,
      documentInputs,
      files,
      fetcher,
      usageSink,
      attempt: "initial",
      prompt: "Extrais cette commande sous forme de données structurées. Si plusieurs images suivent, ce sont les pages du même document dans l’ordre. Applique les règles ERP et effectue le contrôle des totaux avant de répondre.",
    });
    const initialQuality = assessPdfOrderExtraction(initial);

    if (initialQuality.reliable) return initial;

    console.warn("[order_scan_quality] First extraction requires repair", {
      model: provider.model,
      lineCount: initialQuality.lineCount,
      calculatedHt: initialQuality.calculatedHt,
      issueCount: initialQuality.issues.length,
      issues: initialQuality.issues,
    });

    const repairProvider = resolveRepairProvider(provider);
    const repaired = await requestStructuredExtraction({
      provider: repairProvider,
      documentInputs,
      files,
      fetcher,
      usageSink,
      attempt: "repair",
      prompt: buildPdfOrderRepairPrompt(initial, initialQuality.issues),
    });
    const repairedQuality = assessPdfOrderExtraction(repaired);

    if (repairedQuality.reliable) {
      console.info("[order_scan_quality] Automatic repair succeeded", {
        model: repairProvider.model,
        initialModel: provider.model,
        lineCount: repairedQuality.lineCount,
        calculatedHt: repairedQuality.calculatedHt,
      });
      return repaired;
    }

    console.error("[order_scan_error] Extraction remained inconsistent after automatic repair", {
      provider: repairProvider.source,
      model: repairProvider.model,
      initialModel: provider.model,
      lineCount: repairedQuality.lineCount,
      calculatedHt: repairedQuality.calculatedHt,
      issueCount: repairedQuality.issues.length,
      issues: repairedQuality.issues,
    });
    throw new PdfOrderImportError(
      "extraction_failed",
      "L’analyse du document reste incohérente après vérification automatique. Réessayez ou contrôlez le PDF.",
    );
  } catch (error) {
    if (error instanceof PdfOrderImportError) throw error;
    console.error("[order_scan_error] Unexpected extraction failure", {
      provider: provider.source,
      model: provider.model,
      error: error instanceof Error ? error.message : String(error),
    });
    throw new PdfOrderImportError("extraction_failed", "Le document ne contient pas de commande exploitable.");
  }
}

export async function extractPdfOrder(
  file: File,
  fetcher: Fetcher = fetch,
  usageSink: OrderScanUsageSink = logOrderScanUsage,
): Promise<PdfOrderExtraction> {
  return extractOrderDocuments([file], fetcher, usageSink);
}
