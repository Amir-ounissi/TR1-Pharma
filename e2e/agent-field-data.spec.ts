import { expect, test } from "@playwright/test";
import { adminClient, signIn } from "./test-helpers";

const brandId = "00000000-0000-0000-0000-000000000101";
const brandPharmacyId = "00000000-0000-0000-0000-000000000411";
const productId = "00000000-0000-0000-0000-000000000601";

const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlqY+0AAAAASUVORK5CYII=",
  "base64",
);

test("agent terrain : document sell-out analysé puis enregistré avec preuve", async ({ page }) => {
  const admin = adminClient();
  const runId = String(Date.now());
  const sourceLabel = `Document sell-out E2E ${runId}`;

  try {
    await signIn(page, "agent@dermavita.local", /Dermavita/i);
    await page.goto(`/dashboard/pharmacies/${brandPharmacyId}`);

    await page.getByRole("link", { name: "Ajouter du sell-out" }).click();
    await expect(page).toHaveURL(new RegExp(`/dashboard/sell-out\\?pharmacy=${brandPharmacyId}`));
    await expect(page.locator('select[name="brandPharmacyId"]').first()).toHaveValue(brandPharmacyId);

    await page.locator('input[name="document"]').setInputFiles({
      name: `sell-out-${runId}.png`,
      mimeType: "image/png",
      buffer: tinyPng,
    });
    await page.getByRole("button", { name: "Analyser le document" }).click();

    await expect(page.getByText("Prévisualisation TR1")).toBeVisible();
    await expect(page.getByText("Dermacalm 50 ml")).toBeVisible();
    await expect(page.getByLabel("Début période")).toHaveValue("2026-09-01");
    await expect(page.getByLabel("Fin période")).toHaveValue("2026-09-05");
    await expect(page.getByLabel("Unités vendues")).toHaveValue("4");

    await page.getByLabel("Source / contexte").fill(sourceLabel);
    await page.getByRole("button", { name: "Créer le relevé avec ce document" }).click();

    await expect(page).toHaveURL(/\/dashboard\/sell-out\/[0-9a-f-]+$/);
    await expect(page.getByText(sourceLabel)).toBeVisible();

    const { data: captures, error: captureError } = await admin
      .from("sell_out_captures")
      .select("id,brand_id,brand_pharmacy_id,method,status,period_start,period_end,source_label,confidence")
      .eq("brand_id", brandId)
      .eq("brand_pharmacy_id", brandPharmacyId)
      .eq("source_label", sourceLabel);
    expect(captureError).toBeNull();
    expect(captures).toHaveLength(1);
    expect(captures?.[0]).toMatchObject({
      brand_id: brandId,
      brand_pharmacy_id: brandPharmacyId,
      method: "document",
      status: "draft",
      period_start: "2026-09-01",
      period_end: "2026-09-05",
    });
    expect(Number(captures?.[0].confidence)).toBe(0.96);

    const captureId = String(captures![0].id);
    const [{ data: lines, error: linesError }, { data: evidence, error: evidenceError }] = await Promise.all([
      admin
        .from("sell_out_lines")
        .select("product_id,ean,label,units_sold,revenue_ht,confidence")
        .eq("capture_id", captureId),
      admin
        .from("sell_out_evidence")
        .select("storage_path,mime_type,kind")
        .eq("capture_id", captureId),
    ]);
    expect(linesError).toBeNull();
    expect(evidenceError).toBeNull();
    expect(lines).toHaveLength(1);
    expect(lines?.[0]).toMatchObject({
      product_id: productId,
      ean: "3400000000001",
      units_sold: 4,
    });
    expect(Number(lines?.[0].revenue_ht)).toBe(74);
    expect(evidence).toHaveLength(1);
    expect(evidence?.[0]).toMatchObject({ mime_type: "image/png", kind: "photo" });
  } finally {
    const { data: captures } = await admin
      .from("sell_out_captures")
      .select("id")
      .eq("source_label", sourceLabel)
      .eq("brand_id", brandId);
    const captureIds = (captures ?? []).map((row) => String(row.id));
    if (captureIds.length) {
      const { data: evidence } = await admin
        .from("sell_out_evidence")
        .select("storage_path")
        .in("capture_id", captureIds);
      const paths = (evidence ?? []).map((row) => String(row.storage_path));
      if (paths.length) await admin.storage.from("sell-out-evidence").remove(paths);
      await admin.from("sell_out_captures").delete().in("id", captureIds);
    }
  }
});

test("agent terrain : prix observé avec photo et historique", async ({ page }) => {
  const admin = adminClient();
  const runId = String(Date.now());

  try {
    await signIn(page, "agent@dermavita.local", /Dermavita/i);
    await page.goto(`/dashboard/pharmacies/${brandPharmacyId}`);

    await page.getByRole("link", { name: "Relever un prix" }).click();
    await expect(page).toHaveURL(`/dashboard/pharmacies/${brandPharmacyId}/prices`);
    await expect(page.getByRole("heading", { name: "Pharmacie République" })).toBeVisible();

    await page.locator('input[name="photo"]').setInputFiles({
      name: `prix-${runId}.png`,
      mimeType: "image/png",
      buffer: tinyPng,
    });
    await page.getByRole("button", { name: "Analyser la photo" }).click();

    await expect(page.getByText("Prévisualisation TR1")).toBeVisible();
    await expect(page.getByText(/produit proposé : Dermacalm/i)).toBeVisible();
    await expect(page.locator('select[name="productId"]')).toHaveValue(productId);
    await expect(page.locator('input[name="priceTtc"]')).toHaveValue("31.9");
    await expect(page.locator('select[name="priceType"]')).toHaveValue("regular");
    await expect(page.locator('input[name="observedEan"]')).toHaveValue("3400000000001");
    await expect(page.locator('input[name="confidence"]')).toHaveValue("0.95");

    await page.locator('textarea[name="notes"]').fill(`Prix terrain E2E ${runId}`);
    await page.getByRole("button", { name: "Enregistrer le prix observé" }).click();
    await expect(page.getByText("Prix observé et preuve terrain enregistrés.")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(`Prix terrain E2E ${runId}`)).toBeVisible({ timeout: 30_000 });

    const { data: rows, error } = await admin
      .from("pharmacy_price_observations")
      .select("id,brand_id,brand_pharmacy_id,product_id,observed_price_ttc,unit_price_ttc,capture_method,confidence")
      .eq("brand_pharmacy_id", brandPharmacyId)
      .eq("brand_id", brandId)
      .eq("product_id", productId)
      .eq("notes", `Prix terrain E2E ${runId}`);
    expect(error).toBeNull();
    expect(rows).toHaveLength(1);
    expect(rows?.[0]).toMatchObject({
      brand_id: brandId,
      brand_pharmacy_id: brandPharmacyId,
      product_id: productId,
      capture_method: "photo",
    });
    expect(Number(rows?.[0].observed_price_ttc)).toBe(31.9);
    expect(Number(rows?.[0].unit_price_ttc)).toBe(31.9);
    expect(Number(rows?.[0].confidence)).toBe(0.95);

    const observationId = String(rows![0].id);
    const { data: attachments, error: attachmentsError } = await admin
      .from("pharmacy_price_observation_attachments")
      .select("id,object_path,mime_type")
      .eq("observation_id", observationId)
      .is("archived_at", null);
    expect(attachmentsError).toBeNull();
    expect(attachments).toHaveLength(1);
    expect(attachments?.[0].mime_type).toBe("image/png");
    await expect(page.getByRole("link", { name: "Voir la preuve" }).first()).toBeVisible();
  } finally {
    const { data: observations } = await admin
      .from("pharmacy_price_observations")
      .select("id")
      .eq("brand_pharmacy_id", brandPharmacyId)
      .eq("notes", `Prix terrain E2E ${runId}`);
    const ids = (observations ?? []).map((row) => String(row.id));
    if (ids.length) {
      const { data: attachments } = await admin
        .from("pharmacy_price_observation_attachments")
        .select("object_path")
        .in("observation_id", ids);
      const paths = (attachments ?? []).map((row) => String(row.object_path));
      if (paths.length) await admin.storage.from("price-evidence").remove(paths);
      await admin.from("pharmacy_price_observations").delete().in("id", ids);
    }
  }
});
