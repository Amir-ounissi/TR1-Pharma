import { expect, test } from "@playwright/test";
import { signIn } from "./test-helpers";

test("un administrateur crée une campagne Trade Marketing et cible une pharmacie", async ({ page }) => {
  const suffix = Date.now().toString().slice(-7);
  const campaignName = `Activation E2E ${suffix}`;

  await signIn(page, "admin@dermavita.local", /Dermavita/i);
  await page.goto("/dashboard/trade");

  await expect(page.getByRole("heading", { name: "Relier campagnes, terrain, coûts et résultats observés" })).toBeVisible();
  await page.getByText("Nouvelle campagne", { exact: true }).click();
  await page.locator('input[name="name"]').fill(campaignName);
  await page.locator('input[name="code"]').fill(`E2E-${suffix}`);
  await page.locator('input[name="budgetPlannedHt"]').fill("2500");
  await page.locator('textarea[name="objective"]').fill("Tester le pilotage Trade Marketing de bout en bout");
  await page.getByRole("button", { name: "Créer la campagne" }).click();

  const campaignLink = page.getByRole("link", { name: campaignName, exact: true });
  await expect(campaignLink).toBeVisible({ timeout: 30_000 });
  await campaignLink.click();

  await expect(page.getByRole("heading", { name: campaignName, exact: true })).toBeVisible();
  await expect(page.getByText("ROI observé estimé", { exact: true })).toBeVisible();
  await page.locator('select[name="brandPharmacyId"]').selectOption({ label: /Pharmacie République/ });
  await page.locator('input[name="reason"]').fill("Compte stratégique");
  await page.getByRole("button", { name: "Ajouter au ciblage" }).click();

  await expect(page.getByRole("heading", { name: "Pharmacies ciblées" })).toBeVisible();
  await expect(page.getByText("Pharmacie République", { exact: true })).toBeVisible();
});

test("un agent ne voit pas Trade Marketing dans sa navigation", async ({ page }) => {
  await signIn(page, "agent@dermavita.local", /Dermavita/i);
  await expect(page.getByRole("link", { name: "Trade Marketing" })).toHaveCount(0);
});
