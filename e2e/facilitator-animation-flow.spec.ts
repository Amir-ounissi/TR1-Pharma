import { expect, test } from "@playwright/test";
import { password } from "./test-helpers";

test("animateur accède directement à son espace et prépare plusieurs animations", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email professionnel").fill("animatrice@dermavita.local");
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();

  await expect(page).toHaveURL(/\/dashboard\/field$/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Aujourd’hui" })).toBeVisible();
  await expect(page.getByText("Toutes vos marques, animations et rapports dans un seul espace.")).toBeVisible();

  await page.goto("/dashboard/reports");
  await expect(page).toHaveURL(/\/dashboard\/reports$/);
  await expect(page.getByRole("heading", { name: "Mes comptes rendus" })).toBeVisible();
  await expect(page.getByText(/quelle que soit la marque/i)).toBeVisible();

  await page.goto("/dashboard/missions/new");
  await expect(page.getByRole("heading", { name: "Planifier des animations" })).toBeVisible();
  await expect(page.getByText(/Animation = présentiel en pharmacie, gamme complète/)).toBeVisible();
  await expect(page.getByText(/Budget HT proposé/i)).toHaveCount(0);
  await expect(page.getByText(/Produits concernés/i)).toHaveCount(0);
  await expect(page.getByText(/À distance/i)).toHaveCount(0);

  const pharmacySearch = page.getByPlaceholder("Nom, ville, CP, adresse ou CIP…").first();
  await pharmacySearch.fill("75003");
  await expect(page.getByText(/Pharmacie République/i).first()).toBeVisible();

  await page.getByRole("button", { name: "Ajouter une animation" }).click();
  await expect(page.locator('input[type="date"]')).toHaveCount(2);
  await expect(page.getByText("Pharmacie 2")).toBeVisible();
});
