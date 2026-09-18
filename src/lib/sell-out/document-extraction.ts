import {
  SELL_OUT_DOCUMENT_JSON_SCHEMA,
  parseSellOutDocumentExtraction,
  sellOutExtractionHasPotentialPii,
  type SellOutDocumentExtraction,
} from "@/lib/sell-out/document-schema";

export const MAX_SELL_OUT_DOCUMENT_SIZE = 3 * 1024 * 1024;
export const SELL_OUT_DOCUMENT_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const imageTypes = new Set<string>(SELL_OUT_DOCUMENT_IMAGE_TYPES);

const SELL_OUT_EXTRACTION_INSTRUCTIONS = `
Tu extrais uniquement des données de SELL-OUT produits depuis une sortie de caisse de pharmacie, en PDF ou photo.

CONFIDENTIALITÉ — RÈGLE ABSOLUE
- N'extrais et ne reproduis JAMAIS un nom, prénom, identifiant patient/client, adresse personnelle, e-mail, téléphone, numéro de carte de fidélité, ordonnance ou autre donnée personnelle.
- Si le document contient une donnée patient/client identifiable, mets personalDataDetected=true.
- Même quand personalDataDetected=true, ne copie jamais cette donnée dans une autre propriété.
- Les propriétés label, sourceProductCode et ean doivent décrire uniquement des PRODUITS.

PÉRIODE
- periodStart et periodEnd représentent la période couverte par l'état de ventes, au format YYYY-MM-DD.
- Si une seule date de journée est explicitement indiquée, utilise-la pour periodStart et periodEnd.
- Si la période est absente ou incertaine, utilise null. Ne l'invente pas.

LIGNES PRODUITS
- Une ligne représente un produit vendu.
- unitsSold = nombre d'unités vendues. N'utilise jamais un stock ou une quantité commandée comme vente.
- ean = code EAN uniquement s'il est explicitement identifiable.
- sourceProductCode = code produit interne de la caisse lorsqu'il est distinct de l'EAN.
- label = libellé produit tel qu'il apparaît, sans donnée client/patient.
- revenueHt = chiffre d'affaires HT uniquement si le document l'indique explicitement comme HT.
- revenueTtc = chiffre d'affaires TTC uniquement si le document l'indique explicitement comme TTC ou s'il s'agit clairement d'un montant de vente au détail TTC.
- unitPriceTtc = prix unitaire TTC seulement s'il est explicitement lisible.
- taxRate = TVA uniquement si elle est imprimée ou non ambiguë. Ne la déduis pas.
- confidence est entre 0 et 1 et reflète la lisibilité de la ligne.

TOTAUX
- totalUnits = total des unités seulement si le document fournit un total fiable ou si toutes les lignes sont lisibles.
- totalRevenueHt et totalRevenueTtc respectent strictement la nature HT/TTC du document.
- Ne transforme jamais automatiquement un TTC en HT et inversement.

QUALITÉ
- N'invente aucune donnée.
- Utilise null dès qu'une information n'est pas certaine.
- Les warnings doivent être courts, en français, orientés relecture terrain.
`;

export class SellOutDocumentImportError extends Error {
  constructor(readonly code: "invalid_file" | "openai_unavailable" | "extraction_failed" | "pii_detected", message: string) {
    super(message);
  }
}

type Fetcher = typeof fetch;

type ExtractionProvider = {
  apiKey: string;
  endpoint: string;
  model: string;
};

function resolveExtractionProvider(): ExtractionProvider | null {
  const requestedModel =
    process.env.OPENAI_SELL_OUT_MODEL
    ?? process.env.OPENAI_PDF_ORDER_MODEL
    ?? "gpt-5-mini";
  const directApiKey = process.env.OPENAI_API_KEY ?? process.env.OPEN_API_PREVIEW_KEY;
  if (directApiKey) {
    return {
      apiKey: directApiKey,
      endpoint: "https://api.openai.com/v1/responses",
      model: requestedModel.startsWith("openai/")
        ? requestedModel.slice("openai/".length)
        : requestedModel,
    };
  }

  const gatewayApiKey = process.env.AI_GATEWAY_API_KEY ?? process.env.VERCEL_OIDC_TOKEN;
  if (gatewayApiKey) {
    return {
      apiKey: gatewayApiKey,
      endpoint: "https://ai-gateway.vercel.sh/v1/responses",
      model: requestedModel.includes("/") ? requestedModel : "openai/" + requestedModel,
    };
  }

  return null;
}

async function toDocumentInput(file: File, isPdf: boolean) {
  const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
  if (isPdf) {
    return {
      type: "input_file",
      filename: file.name || "sell-out.pdf",
      file_data: "data:application/pdf;base64," + base64,
    };
  }
  return {
    type: "input_image",
    image_url: "data:" + file.type + ";base64," + base64,
    detail: "high",
  };
}

function outputTextFromPayload(payload: {
  output_text?: string;
  output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
}) {
  return payload.output_text
    ?? payload.output?.flatMap((item) => item.content ?? []).find((item) => item.type === "output_text")?.text;
}


export async function extractSellOutDocument(file: File, fetcher: Fetcher = fetch): Promise<SellOutDocumentExtraction> {
  const isPdf = file.type === "application/pdf";
  const isImage = imageTypes.has(file.type);
  if (!isPdf && !isImage) {
    throw new SellOutDocumentImportError("invalid_file", "La sortie de caisse doit être un PDF ou une photo JPG, PNG ou WebP.");
  }
  if (file.size > MAX_SELL_OUT_DOCUMENT_SIZE) {
    throw new SellOutDocumentImportError("invalid_file", "Le document à analyser ne peut pas dépasser 3 Mo.");
  }

  if (process.env.APP_ENV === "test" && process.env.SELL_OUT_DOCUMENT_E2E_MOCK) {
    const mock = parseSellOutDocumentExtraction(JSON.parse(process.env.SELL_OUT_DOCUMENT_E2E_MOCK));
    if (sellOutExtractionHasPotentialPii(mock)) {
      throw new SellOutDocumentImportError("pii_detected", "Le document contient des données client ou patient et ne peut pas être analysé automatiquement.");
    }
    return mock;
  }

  if (process.env.SELL_OUT_DOCUMENT_EXTRACTION_ENABLED !== "true") {
    throw new SellOutDocumentImportError("openai_unavailable", "L’analyse automatique des sorties de caisse n’est pas activée sur cet environnement.");
  }

  const provider = resolveExtractionProvider();
  if (!provider) {
    throw new SellOutDocumentImportError(
      "openai_unavailable",
      "L’analyse automatique de la sortie de caisse est indisponible pour le moment.",
    );
  }

  try {
    const documentInput = await toDocumentInput(file, isPdf);
    const response = await fetcher(provider.endpoint, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + provider.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: provider.model,
        store: false,
        instructions: SELL_OUT_EXTRACTION_INSTRUCTIONS,
        input: [{
          role: "user",
          content: [
            { type: "input_text", text: "Extrais uniquement les ventes produits de cette sortie de caisse. Ne reproduis aucune donnée patient ou client." },
            documentInput,
          ],
        }],
        text: {
          format: {
            type: "json_schema",
            name: "sell_out_document",
            strict: true,
            schema: SELL_OUT_DOCUMENT_JSON_SCHEMA,
          },
        },
      }),
    });
    if (!response.ok) {
      const responseBody = await response.text().catch(() => "");
      console.error("[sell_out_document_analysis] provider rejected request", {
        model: provider.model,
        status: response.status,
        response: responseBody.slice(0, 500),
      });
      throw new SellOutDocumentImportError(
        "openai_unavailable",
        "L’analyse automatique de la sortie de caisse est indisponible pour le moment.",
      );
    }

    const payload = await response.json() as {
      output_text?: string;
      output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
    };
    const outputText = outputTextFromPayload(payload);
    if (!outputText) {
      throw new SellOutDocumentImportError(
        "extraction_failed",
        "Aucune donnée de sell-out exploitable n’a été détectée.",
      );
    }

    const extraction = parseSellOutDocumentExtraction(JSON.parse(outputText));
    if (sellOutExtractionHasPotentialPii(extraction)) {
      throw new SellOutDocumentImportError(
        "pii_detected",
        "Le document contient des données client ou patient et ne peut pas être analysé automatiquement. Utilisez un export anonymisé.",
      );
    }
    return extraction;
  } catch (error) {
    if (error instanceof SellOutDocumentImportError) throw error;
    console.error("[sell_out_document_analysis] unexpected extraction failure", {
      model: provider.model,
      error: error instanceof Error ? error.message : String(error),
    });
    throw new SellOutDocumentImportError(
      "extraction_failed",
      "La sortie de caisse n’a pas pu être interprétée de façon fiable.",
    );
  }
}
