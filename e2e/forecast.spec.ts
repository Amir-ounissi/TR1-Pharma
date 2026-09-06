import { expect, test } from "@playwright/test";
import { signIn } from "./test-helpers";

test("un administrateur comprend l’atterrissage CA et ses composantes", async ({ page }) => {
  await signIn(page, "admin@dermavita.local", /Dermavita/i);
  await page.goto("/dashboard/forecast");

  await expect(page.getByRole("heading", { name: "Comprendre l’atterrissage du chiffre d’affaires avant la fin de l’exercice" })).toBeVisible();
  await expect(page.getByText("Atterrissage déterministe", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Construction de l’atterrissage", { exact: true })).toBeVisible();
  await expect(page.getByText("Prochains réassorts attendus", { exact: true })).toBeVisible();
  await expect(page.getByText("Méthode de calcul", { exact: true })).toBeVisible();
  await expect(page.getByText("aucune décision ou probabilité n’est produite par un modèle opaque", { exact: false })).toBeVisible();
});

test("un agent ne voit pas le Forecast Direction", async ({ page }) => {
  await signIn(page, "agent@dermavita.local", /Dermavita/i);
  await expect(page.getByRole("link", { name: "Forecast" })).toHaveCount(0);

  await page.goto("/dashboard/forecast");
  await expect(page.getByRole("heading", { name: "Comprendre l’atterrissage du chiffre d’affaires avant la fin de l’exercice" })).toHaveCount(0);
});
