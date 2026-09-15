import { expect, test } from "@playwright/test";
import { adminClient, signIn } from "./test-helpers";

const pharmacyRelationId = "00000000-0000-0000-0000-000000000411";

test("brief avant visite depuis Ma journée jusqu'aux actions terrain", async ({ page }) => {
  await signIn(page, "agent@dermavita.local", /Dermavita/i);

  await page.goto("/dashboard/agent");
  await expect(page.getByRole("heading", { name: "Aujourd’hui", exact: true }).first()).toBeVisible();
  await expect(page.getByTestId("next-visit-card")).toContainText("Pharmacie République");

  const briefEntry = page
    .locator(`a[href="/dashboard/pharmacies/${pharmacyRelationId}/brief"]`)
    .filter({ hasText: /Prochaine visite/i });
  await expect(briefEntry).toBeVisible();
  await briefEntry.click();

  await expect(page).toHaveURL(new RegExp(`/dashboard/pharmacies/${pharmacyRelationId}/brief$`));
  await expect(page.getByRole("heading", { name: "Pharmacie République" })).toBeVisible();
  await expect(page.getByText("Objectif conseillé", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Alertes" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Opportunités" })).toBeVisible();

  const commander = page.getByRole("link", { name: /Commander/i });
  const animation = page.getByRole("link", { name: /Animation/i });
  const actions = page.getByRole("link", { name: /^Actions$/i });
  const fiche = page.getByRole("link", { name: /Fiche pharmacie/i });

  await expect(commander).toHaveAttribute("href", `/dashboard/orders/new?pharmacy=${pharmacyRelationId}`);
  await expect(animation).toHaveAttribute("href", "/dashboard/missions/new?mode=animation");
  await expect(actions).toHaveAttribute("href", `/dashboard/pharmacies/${pharmacyRelationId}?tab=activity`);
  await expect(fiche).toHaveAttribute("href", `/dashboard/pharmacies/${pharmacyRelationId}`);

  await fiche.click();
  await expect(page.getByTestId("terrain-pharmacy-header")).toContainText("Pharmacie République");
  const pharmacyBrief = page.getByRole("link", { name: /Préparer ma visite/i }).first();
  await expect(pharmacyBrief).toBeVisible();
  await pharmacyBrief.click();
  await expect(page).toHaveURL(new RegExp(`/dashboard/pharmacies/${pharmacyRelationId}/brief$`));

  const admin = adminClient();
  const visitBrandResult = await admin
    .from("field_visit_brands")
    .select("visit_id")
    .eq("brand_pharmacy_id", pharmacyRelationId)
    .limit(1)
    .maybeSingle();
  expect(visitBrandResult.error).toBeNull();
  expect(visitBrandResult.data?.visit_id).toBeTruthy();

  await page.goto(`/dashboard/visits/${visitBrandResult.data!.visit_id}`);
  const visitBrief = page.getByRole("link", { name: "Préparer ma visite", exact: true });
  await expect(visitBrief).toHaveAttribute("href", `/dashboard/pharmacies/${pharmacyRelationId}/brief`);
  await visitBrief.click();
  await expect(page).toHaveURL(new RegExp(`/dashboard/pharmacies/${pharmacyRelationId}/brief$`));
});
