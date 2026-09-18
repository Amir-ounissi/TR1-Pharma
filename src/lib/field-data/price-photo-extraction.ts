import { z } from "zod";

export const MAX_PRICE_PHOTO_SIZE = 3 * 1024 * 1024;
export const PRICE_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const pricePhotoTypes = new Set<string>(PRICE_PHOTO_TYPES);

const pricePhotoSchema = z.object({
  personalDataDetected: z.boolean(),
  productLabel: z.string().trim().max(300).nullable(),
  ean: z.string().trim().max(32).nullable(),
  priceTtc: z.number().positive().max(10000).nullable(),
  priceType: z.enum(["regular", "promotion", "bundle", "other"]),
  bundleQuantity: z.number().int().min(2).max(100).nullable(),
  confidence: z.number().min(0).max(1),
  warnings: z.array(z.string().trim().max(300)).max(10),
}).superRefine((value, context) => {
  if (value.priceType === "bundle" && value.bundleQuantity === null) {
    context.addIssue({
      code: "custom",
      path: ["bundleQuantity"],
      message: "Une offre en lot doit préciser la quantité.",
    });
  }
  if (value.priceType !== "bundle" && value.bundleQuantity !== null) {
    context.addIssue({
      code: "custom",
      path: ["bundleQuantity"],
      message: "La quantité de lot doit être vide hors offre en lot.",
    });
  }
});

export type PricePhotoExtraction = z.infer<typeof pricePhotoSchema>;

export const PRICE_PHOTO_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    personalDataDetected: { type: "boolean" },
    productLabel: { type: ["string", "null"] },
    ean: { type: ["string", "null"] },
    priceTtc: { type: ["number", "null"], minimum: 0 },
    priceType: {
      type: "string",
      enum: ["regular", "promotion", "bundle", "other"],
    },
    bundleQuantity: {
      type: ["integer", "null"],
      minimum: 2,
      maximum: 100,
    },
    confidence: {
      type: "number",
      minimum: 0,
      maximum: 1,
    },
    warnings: {
      type: "array",
      maxItems: 10,
      items: { type: "string" },
    },
  },
  required: [
    "personalDataDetected",
    "productLabel",
    "ean",
    "priceTtc",
    "priceType",
    "bundleQuantity",
    "confidence",
    "warnings",
  ],
} as const;

const PRICE_EXTRACTION_INSTRUCTIONS = `
Tu analyses une photo prise en pharmacie pour relever le PRIX OBSERVÉ d'un produit.

RÈGLE DE CONFIDENTIALITÉ
- N'extrais jamais de nom, prénom, visage, téléphone, e-mail, identifiant client/patient, ordonnance ou donnée personnelle.
- Si une donnée personnelle identifiable est visible, personalDataDetected=true.
- Ne copie jamais cette donnée dans productLabel, ean ou warnings.

PRODUIT
- productLabel = libellé du produit réellement visible sur le packaging ou l'étiquette rayon.
- ean = code EAN uniquement s'il est clairement lisible. N'invente jamais un EAN.
- Si plusieurs produits sont visibles, choisis uniquement celui dont l'étiquette prix est associée de façon la plus claire. Sinon mets les champs incertains à null.

PRIX
- priceTtc = prix TTC affiché que paierait le consommateur pour l'offre visible.
- priceType = regular pour un prix normal, promotion pour un prix promotionnel, bundle pour une offre du type "2 pour 19,90 €", other si la mécanique n'entre pas clairement dans ces catégories.
- Pour un bundle, priceTtc est le prix TOTAL du lot et bundleQuantity est le nombre d'unités du lot.
- Hors bundle, bundleQuantity doit être null.
- Ne transforme pas un prix au kilo/litre en prix produit.
- Ne déduis pas un prix si l'association produit-étiquette est ambiguë.

QUALITÉ
- confidence est entre 0 et 1 et reflète la certitude globale produit + prix.
- Utilise null plutôt que d'inventer.
- warnings doit être court, en français, et signaler uniquement ce que l'Agent doit vérifier.
`;

export class PricePhotoImportError extends Error {
  constructor(
    readonly code: "invalid_file" | "provider_unavailable" | "extraction_failed" | "pii_detected",
    message: string,
  ) {
    super(message);
  }
}

type ExtractionProvider = {
  apiKey: string;
  endpoint: string;
  model: string;
};

function resolveProvider(): ExtractionProvider | null {
  const requestedModel =
    process.env.OPENAI_PRICE_OBSERVATION_MODEL
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
      model: requestedModel.includes("/") ? requestedModel : `openai/${requestedModel}`,
    };
  }

  return null;
}

function outputText(payload: {
  output_text?: string;
  output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
}) {
  return payload.output_text
    ?? payload.output
      ?.flatMap((item) => item.content ?? [])
      .find((item) => item.type === "output_text")
      ?.text;
}

export function parsePricePhotoExtraction(value: unknown): PricePhotoExtraction {
  return pricePhotoSchema.parse(value);
}

export async function extractPricePhoto(
  file: File,
  fetcher: typeof fetch = fetch,
): Promise<PricePhotoExtraction> {
  if (!pricePhotoTypes.has(file.type)) {
    throw new PricePhotoImportError(
      "invalid_file",
      "La preuve prix doit être une photo JPG, PNG ou WebP.",
    );
  }
  if (file.size < 1 || file.size > MAX_PRICE_PHOTO_SIZE) {
    throw new PricePhotoImportError(
      "invalid_file",
      "La photo prix ne peut pas dépasser 3 Mo.",
    );
  }

  if (process.env.APP_ENV === "test" && process.env.PRICE_PHOTO_E2E_MOCK) {
    const mocked = parsePricePhotoExtraction(JSON.parse(process.env.PRICE_PHOTO_E2E_MOCK));
    if (mocked.personalDataDetected) {
      throw new PricePhotoImportError(
        "pii_detected",
        "La photo contient une donnée personnelle identifiable. Recadrez-la sur le produit et son prix.",
      );
    }
    return mocked;
  }

  const provider = resolveProvider();
  if (!provider) {
    throw new PricePhotoImportError(
      "provider_unavailable",
      "L’analyse automatique du prix n’est pas disponible sur cet environnement.",
    );
  }

  try {
    const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    const response = await fetcher(provider.endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: provider.model,
        store: false,
        instructions: PRICE_EXTRACTION_INSTRUCTIONS,
        input: [{
          role: "user",
          content: [
            {
              type: "input_text",
              text: "Relève uniquement le produit et le prix clairement associés sur cette photo. N'enregistre rien : produis seulement une prévisualisation structurée.",
            },
            {
              type: "input_image",
              image_url: `data:${file.type};base64,${base64}`,
              detail: "high",
            },
          ],
        }],
        text: {
          format: {
            type: "json_schema",
            name: "pharmacy_price_observation",
            strict: true,
            schema: PRICE_PHOTO_JSON_SCHEMA,
          },
        },
      }),
    });

    if (!response.ok) {
      const responseBody = await response.text().catch(() => "");
      console.error("[price_photo_analysis] provider rejected request", {
        model: provider.model,
        status: response.status,
        response: responseBody.slice(0, 500),
      });
      throw new PricePhotoImportError(
        "provider_unavailable",
        "L’analyse automatique du prix est momentanément indisponible.",
      );
    }

    const payload = await response.json() as {
      output_text?: string;
      output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
    };
    const raw = outputText(payload);
    if (!raw) {
      throw new PricePhotoImportError(
        "extraction_failed",
        "Aucun prix exploitable n’a été détecté sur la photo.",
      );
    }

    const extraction = parsePricePhotoExtraction(JSON.parse(raw));
    if (extraction.personalDataDetected) {
      throw new PricePhotoImportError(
        "pii_detected",
        "La photo contient une donnée personnelle identifiable. Recadrez-la sur le produit et son prix.",
      );
    }
    return extraction;
  } catch (error) {
    if (error instanceof PricePhotoImportError) throw error;
    console.error("[price_photo_analysis] unexpected extraction failure", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw new PricePhotoImportError(
      "extraction_failed",
      "Le produit et le prix n’ont pas pu être lus de façon fiable.",
    );
  }
}
