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

test("landing respecte la charte TR1 officielle (logo, couleurs et CTA)", async ({ page }) => {
  await page.goto("/");

  const tokens = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    return {
      navy: root.getPropertyValue("--tr1-navy").trim(),
      ivory: root.getPropertyValue("--tr1-ivory").trim(),
      orange: root.getPropertyValue("--tr1-orange").trim(),
    };
  });
  expect(tokens).toEqual({
    navy: "#0e1d31",
    ivory: "#f4f0e7",
    orange: "#ea7015",
  });

  const logoPaths = page.locator('header svg[aria-label="TR1 Pharma"] path');
  await expect(logoPaths).toHaveCount(2);
  await expect(logoPaths.first()).toHaveAttribute("fill", "#121e31");
  await expect(logoPaths.last()).toHaveAttribute("fill", "#ea6820");
  await expect(page.getByRole("link", { name: "Parlons de votre développement" })).toHaveCSS("background-color", "rgb(234, 112, 21)");
  await expect(page.locator("header")).toHaveCSS("background-color", /244, 240, 231/);
});


test("landing desktop, parcours marque/pharmacie et capture des leads", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: /Implantez votre marque.*Développez ses ventes en pharmacie/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Parlons de votre développement" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Je suis pharmacien" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /De l’ouverture de compte/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Des gammes à découvrir/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Amir Ounissi/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Découvrir mon parcours" })).toHaveAttribute("href", "https://fr.linkedin.com/in/amirounissi");
  await expect(page.locator("main > section")).toHaveCount(6);
  await expect(page.getByRole("img", { name: /Illustration graphique d’une officine/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Une vision claire des actions/ })).toBeVisible();
  await expect(page.getByRole("img", { name: /Capture réelle de l’interface/ })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Ouvrir les bons comptes." })).toBeVisible();
  await page.screenshot({ path: `${artifacts}/landing-desktop.png`, fullPage: true });

  await page.getByRole("link", { name: "Nous contacter" }).first().click();
  await expect(page.locator("#contact")).toBeInViewport();

  const brandForm = page.locator("#contact-marque");
  await expect(brandForm.getByLabel("Nom et prénom")).toHaveAttribute("required", "");
  await brandForm.getByLabel("Nom et prénom").fill("Marie Martin");
  await brandForm.getByLabel("Email professionnel").fill(leadEmail.toUpperCase());
  await brandForm.getByLabel("Marque ou laboratoire").fill("Nova Santé");
  await expect(brandForm.getByLabel("Site web")).not.toHaveAttribute("required");
  await brandForm.getByLabel("Site web").fill("https://nova-sante.test");
  await brandForm.getByLabel("Votre besoin").fill("Développer notre distribution");
  await brandForm.getByRole("button", { name: "Échanger sur mon développement" }).click();
  await expect(page).toHaveURL(/\/merci$/);
  await expect(page.getByRole("heading", { name: "Votre demande a bien été envoyée." })).toBeVisible();

  await page.goto("/");
  const pharmacyForm = page.locator("#contact-pharmacie");
  await pharmacyForm.getByLabel("Nom et prénom").fill("Claire Dupont");
  await pharmacyForm.getByLabel("Email professionnel").fill(pharmacyLeadEmail.toUpperCase());
  await pharmacyForm.getByLabel("Nom de la pharmacie").fill("Pharmacie du Centre");
  await pharmacyForm.getByLabel("Ville ou code postal").fill("13800");
  await pharmacyForm.getByLabel("Votre besoin").fill("Former notre équipe");
  await pharmacyForm.getByRole("button", { name: "Être recontacté" }).click();
  await expect(page).toHaveURL(/\/merci$/);
  await page.screenshot({ path: `${artifacts}/thank-you-desktop.png`, fullPage: true });

  const { data: leads, error } = await adminClient()
    .from("commercial_leads")
    .select("professional_email,status,source,internal_notes")
    .in("professional_email", [leadEmail, pharmacyLeadEmail])
    .order("professional_email");
  expect(error).toBeNull();
  expect(leads).toEqual([
    { professional_email: pharmacyLeadEmail, status: "new", source: "website_pharmacy", internal_notes: "Demande via le site\nVille ou code postal : 13800\nBesoin exprimé : Former notre équipe" },
    { professional_email: leadEmail, status: "new", source: "website_brand", internal_notes: "Demande via le site\nSite web : https://nova-sante.test\nBesoin exprimé : Développer notre distribution" },
  ]);
});
test("landing mobile reste lisible et sans débordement", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: /Implantez votre marque.*Développez ses ventes en pharmacie/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Parlons de votre développement" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Je suis pharmacien" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Amir Ounissi/ })).toBeVisible();
  await expect(page.locator("#contact-marque")).toBeVisible();
  await expect(page.getByRole("img", { name: /Illustration graphique d’une officine/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Une vision claire des actions/ })).toBeVisible();
  await expect(page.getByRole("img", { name: /Capture réelle de l’interface/ })).toHaveCount(0);
  await expect(page.locator("#contact-pharmacie")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: `${artifacts}/landing-mobile.png`, fullPage: true });
});


test("landing : menu mobile accessible et balisage SEO cohérent", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://www.tr1pharma.com/");
  await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute("content", "fr_FR");
  const schemaContent = await page.locator('script[type="application/ld+json"]').textContent();
  expect(schemaContent).not.toBeNull();
  const schema = JSON.parse(schemaContent ?? "{}") as { name?: string; areaServed?: unknown[] };
  expect(schema.name).toBe("TR1 PHARMA");
  expect(schema.areaServed).toHaveLength(3);

  const details = page.locator("header details");
  await details.locator("summary").click();
  await expect(details).toHaveAttribute("open", "");
  await details.getByRole("link", { name: "Pharmacies" }).click();
  await expect(details).not.toHaveAttribute("open", "");
  await expect(page.locator("#pharmacies")).toBeInViewport();

  await details.locator("summary").click();
  await expect(details).toHaveAttribute("open", "");
  await details.locator("summary").press("Escape");
  await expect(details).not.toHaveAttribute("open", "");
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});
