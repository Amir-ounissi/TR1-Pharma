import { expect, test } from "@playwright/test";
import { adminClient, signIn } from "./test-helpers";

const organizationId = "00000000-0000-0000-0000-000000000002";
const brandId = "00000000-0000-0000-0000-000000000101";
const pharmacyId = "00000000-0000-0000-0000-000000000401";
const brandPharmacyId = "00000000-0000-0000-0000-000000000411";
const productId = "00000000-0000-0000-0000-000000000601";
const agentUserId = "00000000-0000-0000-0000-0000000000a3";

test("fiche pharmacie : synthèse sell-out et prix terrain", async ({ page }) => {
  const admin = adminClient();
  const runId = String(Date.now());
  const sourceLabel = `Synthèse terrain ${runId}`;
  const observedAt = new Date(Date.now() + 60_000).toISOString();

  const { data: capture, error: captureError } = await admin
    .from("sell_out_captures")
    .insert({
      organization_id: organizationId,
      brand_id: brandId,
      brand_pharmacy_id: brandPharmacyId,
      method: "manual",
      quality: "declared",
      status: "validated",
      period_start: "2026-09-10",
      period_end: "2026-09-17",
      observed_at: observedAt,
      source_label: sourceLabel,
      confidence: 0.9,
      captured_by: agentUserId,
      updated_by: agentUserId,
    })
    .select("id")
    .single();
  expect(captureError).toBeNull();
  const captureId = String(capture!.id);

  const { error: lineError } = await admin.from("sell_out_lines").insert({
    capture_id: captureId,
    organization_id: organizationId,
    brand_id: brandId,
    brand_pharmacy_id: brandPharmacyId,
    product_id: productId,
    ean: "3400000000001",
    label: "Dermacalm",
    units_sold: 7,
    revenue_ht: 129.5,
    confidence: 0.9,
    created_by: agentUserId,
  });
  expect(lineError).toBeNull();

  const { data: price, error: priceError } = await admin
    .from("pharmacy_price_observations")
    .insert({
      organization_id: organizationId,
      brand_id: brandId,
      brand_pharmacy_id: brandPharmacyId,
      pharmacy_id: pharmacyId,
      product_id: productId,
      observed_ean: "3400000000001",
      observed_price_ttc: 33.33,
      price_type: "regular",
      bundle_quantity: null,
      unit_price_ttc: 33.33,
      capture_method: "manual",
      confidence: 1,
      notes: `Prix synthèse ${runId}`,
      observed_at: observedAt,
      created_by: agentUserId,
    })
    .select("id")
    .single();
  expect(priceError).toBeNull();
  const priceId = String(price!.id);

  try {
    await signIn(page, "agent@dermavita.local", /Dermavita/i);
    await page.goto(`/dashboard/pharmacies/${brandPharmacyId}`);

    await expect(page.getByRole("heading", { name: "Data terrain" })).toBeVisible();
    await expect(page.getByText(sourceLabel)).toBeVisible();
    await expect(page.getByText("7", { exact: true })).toBeVisible();
    await expect(page.getByText("129,50 €")).toBeVisible();
    await expect(page.getByText("33,33 €")).toBeVisible();
    await expect(page.getByText("Dermacalm", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Voir le relevé" })).toHaveAttribute(
      "href",
      `/dashboard/sell-out/${captureId}`,
    );
    await expect(page.getByRole("link", { name: "Historique" })).toHaveAttribute(
      "href",
      `/dashboard/pharmacies/${brandPharmacyId}/prices`,
    );
  } finally {
    await admin.from("pharmacy_price_observations").delete().eq("id", priceId);
    await admin.from("sell_out_captures").delete().eq("id", captureId);
  }
});
