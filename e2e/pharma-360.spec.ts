import { expect, test } from "@playwright/test";
import { signIn } from "./test-helpers";

const relationId = "00000000-0000-0000-0000-000000000411";

test("un administrateur ouvre une fiche Pharma 360 consolidée", async ({ page }) => {
  await signIn(page, "admin@dermavita.local", /Dermavita/i);
  await expect(page.getByRole("link", { name: "Pharma 360", exact: true })).toBeVisible();

  await page.goto("/dashboard/pharma-360");
  await expect(page.getByRole("heading", { name: "Une pharmacie, toutes les dimensions utiles à la décision" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Ouvrir la vue 360" }).first()).toBeVisible();

  await page.goto(`/dashboard/pharma-360/${relationId}`);
  await expect(page.getByRole("heading", { name: /Pharmacie République/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Business & santé commerciale" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Assortiment & distribution" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Terrain" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Trade Marketing" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sell-out" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Opportunités & prochaine décision" })).toBeVisible();
});

test("un agent ne reçoit ni navigation ni fiche Pharma 360 manager", async ({ page }) => {
  await signIn(page, "agent@dermavita.local", /Dermavita/i);
  await expect(page.getByRole("link", { name: "Pharma 360", exact: true })).toHaveCount(0);
  const response = await page.goto(`/dashboard/pharma-360/${relationId}`);
  expect(response?.status()).toBe(404);
});
