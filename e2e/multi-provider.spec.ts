import { expect, test } from "@playwright/test";
import { signIn } from "./test-helpers";

const providerName = `Agence Terrain E2E ${Date.now()}`;
const providerEmail = `terrain-${Date.now()}@example.test`;

test("un administrateur construit et pilote un portefeuille multi-prestataires", async ({ page }) => {
  await signIn(page, "admin@dermavita.local", /Dermavita/i);
  await expect(page.getByRole("link", { name: "Prestataires", exact: true })).toBeVisible();

  await page.goto("/dashboard/providers");
  await expect(page.getByRole("heading", { name: "Prestataires terrain", exact: true })).toBeVisible();
  await expect(page.getByText("Un portefeuille par marque, un intervenant réutilisable", { exact: true })).toBeVisible();

  const form = page.getByTestId("provider-create-form");
  await form.getByLabel("Nom").fill(providerName);
  await form.getByLabel("E-mail").fill(providerEmail);
  await form.getByLabel("Téléphone").fill("0600000099");
  await form.getByLabel("Contrat").selectOption("active");
  await form.getByLabel("Formation").check();
  await form.getByLabel("Tarif journée HT").fill("420");
  await form.getByLabel("Tarif demi-journée HT").fill("260");
  await form.getByLabel("Frais de déplacement").fill("Forfait 45 €");
  await form.getByLabel("Début contrat").fill("2026-01-01");
  await form.getByLabel("Fin contrat").fill("2026-12-31");
  await form.getByLabel("Priorité").fill("10");
  await form.getByLabel("Prestataire préféré").check();
  await form.getByRole("button", { name: "Ajouter au portefeuille" }).click();

  const card = page.getByTestId("provider-card").filter({ hasText: providerName });
  await expect(card).toBeVisible({ timeout: 30_000 });
  await expect(card.getByText("Préféré", { exact: true })).toBeVisible();
  await expect(card.getByText("Animation", { exact: true })).toBeVisible();
  await expect(card.getByText("Formation", { exact: true })).toBeVisible();
  await expect(card.getByText(/Journée 420/)).toBeVisible();

  await card.getByRole("button", { name: "Mettre en pause" }).click();
  await expect(card.getByText("En pause", { exact: true })).toBeVisible({ timeout: 30_000 });

  await card.getByRole("button", { name: "Réactiver" }).click();
  await expect(card.getByText("Actif", { exact: true })).toBeVisible({ timeout: 30_000 });
});

test("un agent ne peut ni voir ni ouvrir la gestion des prestataires", async ({ page }) => {
  await signIn(page, "agent@dermavita.local", /Dermavita/i);
  await expect(page.getByRole("link", { name: "Prestataires", exact: true })).toHaveCount(0);

  await page.goto("/dashboard/providers");
  await expect(page).not.toHaveURL(/\/dashboard\/providers$/);
});
