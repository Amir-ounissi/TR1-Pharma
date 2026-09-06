import { expect, test } from "@playwright/test";
import { signIn } from "./test-helpers";

const connectionName = `CRM E2E ${Date.now()}`;

test("un administrateur prépare un connecteur et son mapping canonique sans appel fournisseur", async ({ page }) => {
  await signIn(page, "admin@dermavita.local", /Dermavita/i);
  await expect(page.getByRole("link", { name: "Intégrations", exact: true })).toBeVisible();

  await page.goto("/dashboard/connectors");
  await expect(page.getByRole("heading", { name: "Connecteurs", exact: true })).toBeVisible();
  await expect(page.getByText("Architecture découplée des fournisseurs", { exact: true })).toBeVisible();

  const createForm = page.getByTestId("connector-create-form");
  await createForm.getByLabel("Nom").fill(connectionName);
  await createForm.getByLabel("Compte externe").fill("portal-e2e");
  await createForm.getByLabel("Référence d’identifiants").fill("oauth://hubspot/e2e");
  await createForm.getByLabel("Configuration non sensible").fill('{"pipeline":"pharmacy"}');
  await createForm.getByRole("button", { name: "Créer la connexion" }).click();

  const card = page.getByTestId("connector-connection-card").filter({ hasText: connectionName });
  await expect(card).toBeVisible();
  await expect(card.getByText(/Identifiants : Configuré/)).toBeVisible();
  await expect(card.getByRole("button", { name: "Activer" })).toBeEnabled();

  await card.getByRole("button", { name: "Activer" }).click();
  await expect(card.getByText("Actif", { exact: true })).toBeVisible();

  const mappingForm = card.getByTestId("connector-mapping-form");
  await mappingForm.getByPlaceholder("companies").fill("companies");
  await mappingForm.getByRole("button", { name: "Ajouter le mapping" }).click();

  await expect(card.getByText("Pharmacies ← companies", { exact: true })).toBeVisible();
  await expect(card.getByText(/Vers TR1 · conflits manual · actif/)).toBeVisible();
  await expect(page.getByText(/Aucune synchronisation exécutée/)).toBeVisible();
});

test("un agent ne peut ni voir ni ouvrir l’administration des connecteurs", async ({ page }) => {
  await signIn(page, "agent@dermavita.local", /Dermavita/i);
  await expect(page.getByRole("link", { name: "Intégrations", exact: true })).toHaveCount(0);

  await page.goto("/dashboard/connectors");
  await expect(page).not.toHaveURL(/\/dashboard\/connectors$/);
});
