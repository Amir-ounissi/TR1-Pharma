import { z } from "zod";

import { mobileApiError, MobileApiError, requireMobileBrand, requireMobileCapability } from "@/lib/mobile-api";
import { parseSellOutDocumentExtraction, sellOutExtractionHasPotentialPii } from "@/lib/sell-out/document-schema";

export const runtime = "nodejs";

const reviewedLineSchema = z.object({
  productId: z.string().uuid(),
  sourceProductCode: z.string().trim().max(120).nullable(),
  ean: z.string().trim().max(32).nullable(),
  label: z.string().trim().max(300).nullable(),
  unitsSold: z.number().int().nonnegative(),
  revenueHt: z.number().finite().nonnegative().nullable(),
  confidence: z.number().finite().min(0).max(1).nullable(),
});

const bodySchema = z.object({
  brandId: z.string().uuid(),
  missionId: z.string().uuid(),
  missionAttachmentId: z.string().uuid(),
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  extraction: z.unknown(),
  lines: z.array(reviewedLineSchema).min(1).max(150),
});

export async function POST(request: Request) {
  try {
    const input = bodySchema.parse(await request.json());
    if (input.periodEnd < input.periodStart) throw new MobileApiError(400, "La fin de période doit être après le début.");

    const extraction = parseSellOutDocumentExtraction(input.extraction);
    if (sellOutExtractionHasPotentialPii(extraction)) {
      throw new MobileApiError(422, "Le relevé contient une donnée client ou patient et ne peut pas être enregistré.");
    }

    const { supabase, brand } = await requireMobileBrand(request, input.brandId);
    if (brand.role !== "facilitator") throw new MobileApiError(403, "Cette action est réservée à l’intervenant affecté à la mission.");
    await requireMobileCapability(supabase, brand.id, "sell_out");

    const confidenceValues = input.lines.map((line) => line.confidence).filter((value): value is number => value != null);
    const confidence = extraction.confidence
      ?? (confidenceValues.length ? confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length : null);

    const { data, error } = await supabase.rpc("create_facilitator_sell_out_draft", {
      target_mission_id: input.missionId,
      target_mission_attachment_id: input.missionAttachmentId,
      target_period_start: input.periodStart,
      target_period_end: input.periodEnd,
      target_confidence: confidence,
      target_raw_extraction: extraction,
      target_lines: input.lines,
    });
    if (error || typeof data !== "string") {
      const forbidden = error?.code === "42501";
      throw new MobileApiError(forbidden ? 403 : 400, error?.message || "Le relevé sell-out n’a pas pu être préparé.");
    }

    return Response.json({ captureId: data, status: "draft" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: "La revue sell-out est incomplète ou invalide." }, { status: 400 });
    }
    return mobileApiError(error);
  }
}
