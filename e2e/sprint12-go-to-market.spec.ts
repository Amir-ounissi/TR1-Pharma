import { mkdirSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { adminClient, signIn, userClient } from "./test-helpers";

test.describe.configure({ mode: "serial" });

const artifacts = "artifacts/sprint12";
const runId = Date.now();
const leadEmail = `pilot-${runId}@nova-sante.test`;
const pharmacyLeadEmail = `pharmacy-${runId}@officine.test`;
const primaryBrandId = "00000000-0000-0000-0000-000000000101";

async function primaryBrandName() {
  const { data, error } = await adminClient()
    .from("brands")
    .select("name")
    .eq("id", primaryBrandId)
    .single();
  if (error || !data?.name) throw error ?? new Error("Primary E2E brand is missing.");
  return data.name;
}

test.beforeAll(() => mkdirSync(artifacts, { recursive: true }));

test("landing desktop, parcours marque/pharmacie et capture des leads", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Votre prochain point de vente commence sur le terrain." })).toBeVisible();
  await expect(page.getByText("Du sell-in au sell-out.", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Parlons de votre marque" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Je suis pharmacien" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Une marque se développe visite après visite." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Une gamme ne doit pas juste arriver. Elle doit être accompagnée." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Vous savez ce qui s’est passé. Et ce qui vient ensuite." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Le terrain ne commence pas au même endroit pour tout le monde." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Voir le travail terrain" })).toHaveAttribute("href", "https://fr.linkedin.com/in/amirounissi");
  await expect(page.locator("main > section")).toHaveCount(7);
  await page.screenshot({ path: `${artifacts}/landing-desktop.png`, fullPage: true });

  await page.getByRole("link", { name: "Nous contacter" }).first().click();
  await expect(page.locator("#contact")).toBeInViewport();

  const brandForm = page.locator("#contact-marque");
  await expect(brandForm.getByLabel("Nom et prénom")).toHaveAttribute("required", "");
  await brandForm.getByLabel("Nom et prénom").fill("Marie Martin");
  await brandForm.getByLabel("Email professionnel").fill(leadEmail.toUpperCase());
  await brandForm.getByLabel("Marque ou laboratoire").fill("Nova Santé");
  await brandForm.getByRole("button", { name: "Parler de mon développement" }).click();
  await expect(page).toHaveURL(/\/merci$/);
  await expect(page.getByRole("heading", { name: "Votre demande a bien été envoyée." })).toBeVisible();

  await page.goto("/");
  const pharmacyForm = page.locator("#contact-pharmacie");
  await pharmacyForm.getByLabel("Nom et prénom").fill("Claire Dupont");
  await pharmacyForm.getByLabel("Email professionnel").fill(pharmacyLeadEmail.toUpperCase());
  await pharmacyForm.getByLabel("Nom de la pharmacie").fill("Pharmacie du Centre");
  await pharmacyForm.getByRole("button", { name: "Être recontacté" }).click();
  await expect(page).toHaveURL(/\/merci$/);
  await page.screenshot({ path: `${artifacts}/thank-you-desktop.png`, fullPage: true });

  const { data: leads, error } = await adminClient()
    .from("commercial_leads")
    .select("professional_email,status,source")
    .in("professional_email", [leadEmail, pharmacyLeadEmail])
    .order("professional_email");
  expect(error).toBeNull();
  expect(leads).toEqual([
    { professional_email: pharmacyLeadEmail, status: "new", source: "website_pharmacy" },
    { professional_email: leadEmail, status: "new", source: "website_brand" },
  ]);
});
test("landing mobile reste lisible et sans débordement", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Votre prochain point de vente commence sur le terrain." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Parlons de votre marque" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Je suis pharmacien" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Vous savez ce qui s’est passé. Et ce qui vient ensuite." })).toBeVisible();
  await expect(page.locator("#contact-marque")).toBeVisible();
  await expect(page.locator("#contact-pharmacie")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: `${artifacts}/landing-mobile.png`, fullPage: true });
});

