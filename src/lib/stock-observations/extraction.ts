import { z } from "zod";

const quantity = z.number().int().min(0).max(100000).nullable();
const shortText = z.string().trim().max(160).nullable();

export const stockPhotoSchema = z.object({
  personalDataDetected: z.boolean(),
  productLabel: shortText,
  ean: z.string().trim().max(32).nullable(),
  stockShelf: quantity,
  stockBackroom: quantity,
  facings: z.number().int().min(0).max(1000).nullable(),
  labelLayout: z.enum(["split_boxes", "hyphen_and_facings", "promotion", "unknown"]),
  rawStockText: z.string().trim().max(120).nullable(),
  confidence: z.number().min(0).max(1).nullable(),
  warnings: z.array(z.string().trim().min(1).max(250)).max(10),
}).strict();

export type StockPhotoExtraction = z.infer<typeof stockPhotoSchema>;

export const STOCK_PHOTO_JSON_SCHEMA = {
  type: "object", additionalProperties: false,
  required: [
    "personalDataDetected", "productLabel", "ean", "stockShelf",
    "stockBackroom", "facings", "labelLayout", "rawStockText", "confidence", "warnings",
  ],
  properties: {
    personalDataDetected: { type: "boolean" },
    productLabel: { type: ["string", "null"] },
    ean: { type: ["string", "null"] },
    stockShelf: { type: ["integer", "null"] },
    stockBackroom: { type: ["integer", "null"] },
    facings: { type: ["integer", "null"] },
    labelLayout: { type: "string", enum: ["split_boxes", "hyphen_and_facings", "promotion", "unknown"] },
    rawStockText: { type: ["string", "null"] },
    confidence: { type: ["number", "null"] },
    warnings: { type: "array", maxItems: 10, items: { type: "string" } },
  },
} as const;

const INSTRUCTIONS = [
  "Tu analyses UNIQUEMENT une étiquette électronique de pharmacie, pas les emballages voisins.",
  "Ne conserve aucune information identifiant un patient ou une personne. Si visible/lisible, personalDataDetected=true et aucun contenu personnel dans les autres champs.",
  "Lis productLabel et ean seulement s'ils sont visibles. Ignore les numéros de promotion, dates, prix et références de gondole comme quantités de stock.",
  "stockShelf = unités présentes en rayon ; stockBackroom = unités en réserve ou dépôt ; facings = nombre d'emplacements de présentation distincts de cette référence, JAMAIS ajouté au stock.",
  "Certaines étiquettes montrent deux cases numériques : la première peut être le stock rayon et la seconde la réserve. D'autres montrent '10-2' dans une case et '3' à côté : selon les conventions officinales, cela peut signifier 10 rayon, 2 réserve, 3 facings.",
  "CES FORMATS NE SONT PAS UNIVERSELS. Ne transforme pas une convention supposée en un fait : si la signification n'est pas démontrée par l'image, renvoie des valeurs proposées mais avertis 'Convention de l’étiquette à confirmer' et réduis la confiance.",
  "Pour une étiquette promo sans indication de stock clairement visible, garde toutes les quantités à null. Un chiffre manquant ne signifie PAS zéro.",
  "rawStockText conserve seulement les chiffres et séparateurs pertinents visibles dans la zone de stock (jamais d'informations personnelles).",
  "labelLayout = split_boxes pour deux cases stock distinctes ; hyphen_and_facings si deux stocks sont séparés par un tiret et des facings indiqués ; promotion si la zone ne montre que les promotions ; unknown sinon.",
  "confidence exprime la certitude de l'interprétation stock et non la lisibilité du prix.",
  "Les warnings doivent être courts, en français. Toute déduction incertaine est signalée.",
].join("\n");

export class StockPhotoError extends Error {
  constructor(readonly code: "invalid_file" | "unavailable" | "failed" | "pii_detected", message: string) {
    super(message);
  }
}

const imageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
export const MAX_STOCK_PHOTO_BYTES = 5 * 1024 * 1024;

export async function extractStockPhoto(photo: File, fetcher: typeof fetch = fetch): Promise<StockPhotoExtraction> {
  if (!imageTypes.has(photo.type) || photo.size < 1 || photo.size > MAX_STOCK_PHOTO_BYTES) {
    throw new StockPhotoError("invalid_file", "Utilisez une photo JPG, PNG ou WebP de 5 Mo maximum.");
  }
  if (process.env.APP_ENV === "test" && process.env.STOCK_PHOTO_E2E_MOCK) {
    const value = stockPhotoSchema.parse(JSON.parse(process.env.STOCK_PHOTO_E2E_MOCK));
    if (value.personalDataDetected) throw new StockPhotoError("pii_detected", "Recadrez la photo pour masquer les données personnelles.");
    return value;
  }
  if (process.env.STOCK_PHOTO_EXTRACTION_ENABLED !== "true") {
    throw new StockPhotoError("unavailable", "Lecture IA indisponible ici. Vous pouvez saisir le relevé manuellement.");
  }
  const apiKey = process.env.OPENAI_API_KEY ?? process.env.OPEN_API_PREVIEW_KEY;
  if (!apiKey) throw new StockPhotoError("unavailable", "Clé OpenAI non configurée. Saisie manuelle disponible.");
  let fileId: string | null = null;
  try {
    const upload = new FormData();
    upload.set("purpose", "vision");
    upload.set("file", photo);
    const uploaded = await fetcher("https://api.openai.com/v1/files", {
      method: "POST", headers: { Authorization: `Bearer ${apiKey}` }, body: upload,
    });
    if (!uploaded.ok) throw new StockPhotoError("unavailable", "La photo n'a pas pu être envoyée pour analyse.");
    fileId = (await uploaded.json() as { id?: string }).id ?? null;
    if (!fileId) throw new StockPhotoError("failed", "Fichier non reconnu par l'analyse IA.");
    const response = await fetcher("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_STOCK_PHOTO_MODEL ?? process.env.OPENAI_PRICE_PHOTO_MODEL ?? "gpt-5",
        store: false,
        instructions: INSTRUCTIONS,
        input: [{
          role: "user",
          content: [
            { type: "input_text", text: "Extrais les quantités stock rayon, réserve et facings sur cette étiquette. C'est une proposition à vérifier par le commercial." },
            { type: "input_image", file_id: fileId, detail: "original" },
          ],
        }],
        text: { format: { type: "json_schema", name: "pharmacy_stock_observation", strict: true, schema: STOCK_PHOTO_JSON_SCHEMA } },
      }),
    });
    if (!response.ok) throw new StockPhotoError("unavailable", "L'analyse IA est temporairement indisponible.");
    const payload = await response.json() as {
      output_text?: string;
      output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
    };
    const text = payload.output_text
      ?? payload.output?.flatMap((item) => item.content ?? []).find((item) => item.type === "output_text")?.text;
    if (!text) throw new StockPhotoError("failed", "Aucune lecture exploitable sur l'étiquette.");
    const extraction = stockPhotoSchema.parse(JSON.parse(text));
    if (extraction.personalDataDetected) {
      throw new StockPhotoError("pii_detected", "Recadrez la photo : des données personnelles sont détectées.");
    }
    return extraction;
  } catch (error) {
    if (error instanceof StockPhotoError) throw error;
    throw new StockPhotoError("failed", "La lecture de l'étiquette n'a pas pu être validée.");
  } finally {
    if (fileId) await fetcher(`https://api.openai.com/v1/files/${fileId}`, {
      method: "DELETE", headers: { Authorization: `Bearer ${apiKey}` },
    }).catch(() => undefined);
  }
}
