import { expect, test } from "@playwright/test";
import { signIn } from "./test-helpers";

test("un administrateur saisit puis valide un sell-out déclaré", async ({ page }) => {
  await signIn(page, "admin@dermavita.local", /Dermavita/i);
  await page.goto("/dashboard/sell-out");

  await expect(page.getByText("Sell-out", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Confirmé", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Déclaré", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Estimé", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Importé", { exact: true }).first()).toBeVisible();

  await page.getByText("Saisir un relevé", { exact: true }).click();
  await page.locator('select[name="brandPharmacyId"]').selectOption({ index: 1 });
  await page.locator('select[name="method"]').selectOption("manual");
  await page.locator('input[name="sourceLabel"]').fill("Déclaration E2E terrain");
  await page.getByRole("button", { name: "Créer le relevé" }).click();

  await expect(page).toHaveURL(/\/dashboard\/sell-out\/[0-9a-f-]+$/i, { timeout: 30_000 });
  await expect(page.getByText("Déclaration E2E terrain", { exact: true })).toBeVisible({ timeout: 30_000 });
  await page.locator('input[name="label"]').fill("Produit E2E sell-out");
  await page.locator('input[name="unitsSold"]').fill("5");
  await page.locator('input[name="revenueHt"]').fill("50");
  await page.getByRole("button", { name: "Ajouter la ligne" }).click();

  await expect(page.getByText("Produit E2E sell-out", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Soumettre pour relecture humaine" }).click();
  await page.reload();
  await expect(page.getByText("Validation humaine", { exact: true })).toBeVisible();
  await page.locator('textarea[name="notes"]').fill("Relecture E2E validée");
  await page.getByRole("button", { name: "Valider le relevé" }).click();
  await page.reload();

  await expect(page.getByText("Déclaré", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Relecture E2E validée", { exact: true })).toBeVisible();
});

test("un agent dispose du point d’entrée sell-out dans Plus", async ({ page }) => {
  await signIn(page, "agent@dermavita.local", /Dermavita/i);
  await page.goto("/dashboard/agent/more");
  await expect(page.getByRole("link", { name: "Sell-out", exact: true })).toBeVisible();
});
