import {
  PRICE_PHOTO_JSON_SCHEMA,
  parsePricePhotoExtraction,
  type PricePhotoExtraction,
} from "@/lib/price-observations/photo-schema";

export const MAX_PRICE_PHOTO_BYTES = 5 * 1024 * 1024;
const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

const INSTRUCTIONS = `
Tu analyses une photo prise en pharmacie pour relever un PRIX OBSERVÉ d'un produit.

RÈGLES DE CONFIDENTIALITÉ
- N'extrais aucune donnée permettant d'identifier une personne.
- Si une personne, un ticket nominatif, un nom client/patient, téléphone, e-mail ou autre donnée personnelle est visible et lisible, personalDataDetected=true.
- Ne recopie jamais cette donnée dans les autres champs.

PRODUIT
- productLabel = nom du produit visible sur l'emballage ou l'étiquette.
- ean = code EAN seulement s'il est explicitement lisible.
- N'invente pas de produit ou d'EAN.

PRIX
- priceTtc = prix TTC effectivement affiché et associé au produit.
- priceType = regular pour prix normal, promotion pour remise/prix promo, bundle pour un lot, other si visible mais non classable.
- bundleQuantity = quantité du lot uniquement si clairement identifiable.
- Si plusieurs prix sont visibles et l'association au produit est incertaine, retourne priceTtc=null et ajoute un warning.

QUALITÉ
- confidence entre 0 et 1.
- Utilise null dès que l'information n'est pas suffisamment certaine.
- warnings courts, en français, orientés validation terrain.
`;

export class PricePhotoAnalysisError extends Error {
  constructor(readonly code: "invalid_file" | "unavailable" | "failed" | "pii_detected", message: string) {
    super(message);
  }
}

export async function extractPricePhoto(file: File, fetcher: typeof fetch = fetch): Promise<PricePhotoExtraction> {
  if (!allowedTypes.has(file.type)) {
    throw new PricePhotoAnalysisError("invalid_file", "Utilisez une photo JPG, PNG ou WebP.");
  }
  if (file.size < 1 || file.size > MAX_PRICE_PHOTO_BYTES) {
    throw new PricePhotoAnalysisError("invalid_file", "La photo ne doit pas dépasser 5 Mo.");
  }

  if (process.env.APP_ENV === "test" && process.env.PRICE_PHOTO_E2E_MOCK) {
    const mock = parsePricePhotoExtraction(JSON.parse(process.env.PRICE_PHOTO_E2E_MOCK));
    if (mock.personalDataDetected) {
      throw new PricePhotoAnalysisError("pii_detected", "La photo contient une donnée personnelle identifiable.");
    }
    return mock;
  }

  if (process.env.PRICE_PHOTO_EXTRACTION_ENABLED !== "true") {
    throw new PricePhotoAnalysisError("unavailable", "L’analyse automatique des prix n’est pas activée sur cet environnement.");
  }

  const apiKey = process.env.OPENAI_API_KEY ?? process.env.OPEN_API_PREVIEW_KEY;
  if (!apiKey) {
    throw new PricePhotoAnalysisError("unavailable", "L’analyse automatique de la photo est indisponible pour le moment.");
  }

  let fileId: string | null = null;
  try {
    const upload = new FormData();
    upload.set("purpose", "vision");
    upload.set("file", file);
    const uploadResponse = await fetcher("https://api.openai.com/v1/files", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: upload,
    });
    if (!uploadResponse.ok) {
      throw new PricePhotoAnalysisError("unavailable", "La photo n’a pas pu être préparée pour analyse.");
    }

    fileId = (await uploadResponse.json() as { id?: string }).id ?? null;
    if (!fileId) throw new PricePhotoAnalysisError("failed", "La photo n’a pas pu être préparée pour analyse.");

    const response = await fetcher("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_PRICE_PHOTO_MODEL ?? process.env.OPENAI_SELL_OUT_MODEL ?? process.env.OPENAI_PDF_ORDER_MODEL ?? "gpt-5",
        store: false,
        instructions: INSTRUCTIONS,
        input: [{
          role: "user",
          content: [
            {
              type: "input_text",
              text: "Identifie uniquement le produit et le prix TTC affiché sur cette photo. N’enregistre rien : retourne une proposition à valider.",
            },
            { type: "input_image", file_id: fileId, detail: "original" },
          ],
        }],
        text: {
          format: {
            type: "json_schema",
            name: "price_photo_observation",
            strict: true,
            schema: PRICE_PHOTO_JSON_SCHEMA,
          },
        },
      }),
    });
    if (!response.ok) {
      throw new PricePhotoAnalysisError("unavailable", "L’analyse automatique de la photo est indisponible pour le moment.");
    }

    const payload = await response.json() as {
      output_text?: string;
      output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
    };
    const outputText = payload.output_text
      ?? payload.output?.flatMap((item) => item.content ?? []).find((item) => item.type === "output_text")?.text;
    if (!outputText) {
      throw new PricePhotoAnalysisError("failed", "Aucun prix exploitable n’a été détecté.");
    }

    const extraction = parsePricePhotoExtraction(JSON.parse(outputText));
    if (extraction.personalDataDetected) {
      throw new PricePhotoAnalysisError(
        "pii_detected",
        "La photo contient une donnée personnelle identifiable. Recadrez la photo sur le produit et son étiquette prix.",
      );
    }
    return extraction;
  } catch (error) {
    if (error instanceof PricePhotoAnalysisError) throw error;
    throw new PricePhotoAnalysisError("failed", "La photo n’a pas pu être interprétée de façon fiable.");
  } finally {
    if (fileId) {
      await fetcher(`https://api.openai.com/v1/files/${fileId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${apiKey}` },
      }).catch(() => undefined);
    }
  }
}
