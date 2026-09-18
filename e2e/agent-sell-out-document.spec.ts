import { expect, test } from "@playwright/test";
import { adminClient, signIn } from "./test-helpers";

const brandPharmacyId = "00000000-0000-0000-0000-000000000411";
const productId = "00000000-0000-0000-0000-000000000601";

const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlqY+0AAAAASUVORK5CYII=",
  "base64",
);

test("agent sell-out : document analysé puis validé avant toute persistance", async ({ page }) => {
  const admin = adminClient();
  const runId = String(Date.now());
  let captureId: string | null = null;

  try {
    await signIn(page, "agent@dermavita.local", /Dermavita/i);
    await page.goto(`/dashboard/sell-out?pharmacy=${brandPharmacyId}&method=document`);

    await expect(page.locator('select[name="brandPharmacyId"]')).toHaveValue(brandPharmacyId);
    await expect(page.locator('select[name="method"]')).toHaveValue("document");
    await page.locator('input[name="periodStart"]').fill("2026-09-01");
    await page.locator('input[name="periodEnd"]').fill("2026-09-07");
    await page.locator('input[name="sourceLabel"]').fill(`Sortie caisse Agent ${runId}`);
    await page.getByRole("button", { name: "Créer le relevé" }).click();

    await expect(page).toHaveURL(/\/dashboard\/sell-out\/[0-9a-f-]+$/i);
    captureId = new URL(page.url()).pathname.split("/").pop() ?? null;
    expect(captureId).toBeTruthy();

    await expect(page.getByRole("heading", { name: "Lecture automatique du relevé" })).toBeVisible();
    const analyzerInput = page.locator('input[type="file"]').first();
    await analyzerInput.setInputFiles({
      name: `sell-out-${runId}.png`,
      mimeType: "image/png",
      buffer: tinyPng,
    });

    await page.getByRole("button", { name: "Analyser le document" }).click();
    await expect(page.getByText("Prévisualisation à confirmer")).toBeVisible({ timeout: 30_000 });

    const previewForm = page.locator("form").filter({ hasText: "Prévisualisation à confirmer" });
    await expect(previewForm.locator("select").first()).toHaveValue(productId);
    await expect(previewForm.getByLabel("Unités vendues")).toHaveValue("7");
    await expect(previewForm.getByLabel("CA HT")).toHaveValue("198.39");

    const beforeLines = await admin
      .from("sell_out_lines")
      .select("id", { count: "exact", head: true })
      .eq("capture_id", captureId!);
    const beforeEvidence = await admin
      .from("sell_out_evidence")
      .select("id", { count: "exact", head: true })
      .eq("capture_id", captureId!);
    expect(beforeLines.count).toBe(0);
    expect(beforeEvidence.count).toBe(0);

    await previewForm.getByRole("button", { name: "Valider ces données et enregistrer" }).click();
    await expect(page.getByText(/1 ligne\(s\) et justificatif enregistrés/)).toBeVisible({ timeout: 30_000 });

    const { data: lines, error: linesError } = await admin
      .from("sell_out_lines")
      .select("product_id,ean,units_sold,revenue_ht,confidence")
      .eq("capture_id", captureId!);
    expect(linesError).toBeNull();
    expect(lines).toHaveLength(1);
    expect(lines?.[0]).toMatchObject({
      product_id: productId,
      ean: "3400000000001",
      units_sold: 7,
    });
    expect(Number(lines?.[0].revenue_ht)).toBe(198.39);
    expect(Number(lines?.[0].confidence)).toBe(0.96);

    const { data: evidence, error: evidenceError } = await admin
      .from("sell_out_evidence")
      .select("storage_path,mime_type,sha256,extraction_payload_hash")
      .eq("capture_id", captureId!);
    expect(evidenceError).toBeNull();
    expect(evidence).toHaveLength(1);
    expect(evidence?.[0].mime_type).toBe("image/png");
    expect(evidence?.[0].sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(evidence?.[0].extraction_payload_hash).toMatch(/^[0-9a-f]{64}$/);

    const { data: capture, error: captureError } = await admin
      .from("sell_out_captures")
      .select("status,period_start,period_end,confidence,extraction_version,raw_extraction")
      .eq("id", captureId!)
      .single();
    expect(captureError).toBeNull();
    expect(capture).toMatchObject({
      status: "draft",
      period_start: "2026-09-01",
      period_end: "2026-09-07",
      extraction_version: "agent-web-document-v1",
    });
    expect(Number(capture?.confidence)).toBe(0.96);
    expect(capture?.raw_extraction).toMatchObject({
      personalDataDetected: false,
      totalUnits: 7,
    });
  } finally {
    if (captureId) {
      const { data: evidence } = await admin
        .from("sell_out_evidence")
        .select("storage_path")
        .eq("capture_id", captureId);
      const paths = (evidence ?? []).map((row) => String(row.storage_path));
      if (paths.length) await admin.storage.from("sell-out-evidence").remove(paths);
      await admin.from("sell_out_captures").delete().eq("id", captureId);
    }
  }
});
