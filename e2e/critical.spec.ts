import { expect, test, type Page } from "@playwright/test";

const password = "DemoTR1!2026";

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email professionnel").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/select-brand/, { timeout: 30_000 });
  await page.getByRole("button", { name: /Dermavita/i }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 30_000 });
}

async function chooseOption(page: Page, control: string, option: RegExp | string) {
  await page.getByLabel(control).click();
  await page.getByRole("option", { name: option }).click();
}

async function createOrder(page: Page, number: string, type: "initial" | "reorder", date: string) {
  await page.getByLabel("Date de commande").fill(date);
  await chooseOption(page, "Statut", "invoiced");
  await chooseOption(page, "Type demandé", type);
  await page.getByLabel("Numéro de commande").fill(number);
  await chooseOption(page, "Produit", /Dermacalm/i);
  await page.locator('input[name="quantity"]').fill("2");
  await page.locator('input[name="unitPriceHt"]').fill("18.50");
  await page.getByRole("button", { name: "Créer la commande" }).click();
  await expect(page.getByText("Commande créée et indicateurs recalculés.")).toBeVisible();
}

async function openOrder(page: Page, number: string) {
  await page.goto("/dashboard/orders");
  const link = page.getByRole("link", { name: number });
  await expect(link).toBeVisible();
  const href = await link.getAttribute("href");
  expect(href).toBeTruthy();
  await page.goto(href!);
  await expect(page.getByRole("heading", { name: number })).toBeVisible();
  return page.url();
}

test("parcours implantation, réassort et cloisonnement agent", async ({ browser }) => {
  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  await signIn(adminPage, "admin@dermavita.local");

  await adminPage.goto("/dashboard/pharmacies/new");
  await adminPage.getByLabel("Raison sociale (création)").fill("Pharmacie E2E SAS");
  await adminPage.getByLabel("Nom commercial").fill("Pharmacie E2E");
  await adminPage.getByLabel("SIRET").fill("99999999900011");
  await adminPage.getByLabel("Adresse", { exact: true }).fill("1 rue du Test");
  await adminPage.getByLabel("Code postal").fill("75001");
  await adminPage.getByLabel("Ville").fill("Paris");
  await adminPage.getByRole("button", { name: "Créer la pharmacie et la relation" }).click();
  await adminPage.waitForTimeout(1_000);

  await adminPage.goto("/dashboard/orders/new");
  await chooseOption(adminPage, "Pharmacie", /Pharmacie E2E/i);
  await createOrder(adminPage, "E2E-INITIAL", "initial", "2026-07-21T10:00");
  const initialOrderUrl = await openOrder(adminPage, "E2E-INITIAL");
  await expect(adminPage.getByText("Implantation", { exact: true })).toBeVisible();

  const pharmacyUrl = await adminPage.getByRole("link", { name: "Voir la pharmacie" }).getAttribute("href");
  expect(pharmacyUrl).toBeTruthy();
  const pharmacyPath = pharmacyUrl!.split("?")[0];
  await adminPage.goto(pharmacyPath);
  await expect(adminPage.getByRole("heading", { name: "Pharmacie E2E" })).toBeVisible();
  await adminPage.goto(`${pharmacyPath}?tab=orders`);
  await adminPage.getByRole("link", { name: "Créer une commande" }).click();
  await createOrder(adminPage, "E2E-REORDER", "reorder", "2026-07-22T10:00");
  await openOrder(adminPage, "E2E-REORDER");
  await expect(adminPage.getByText("Réassort", { exact: true })).toBeVisible();

  await adminPage.goto(`${pharmacyPath}?tab=performance`);
  await expect(adminPage.getByText("Commandes valides")).toBeVisible();
  await expect(adminPage.getByText("Réassorts")).toBeVisible();
  await expect(adminPage.getByText("2", { exact: true }).first()).toBeVisible();

  const agentContext = await browser.newContext();
  const agentPage = await agentContext.newPage();
  await signIn(agentPage, "agent@dermavita.local");
  await agentPage.goto(initialOrderUrl);
  await expect(agentPage.getByText(/could not be found|introuvable/i)).toBeVisible();

  await agentContext.close();
  await adminContext.close();
});
