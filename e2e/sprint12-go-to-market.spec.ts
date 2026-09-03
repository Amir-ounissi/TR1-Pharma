import { mkdirSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { adminClient, signIn, userClient } from "./test-helpers";

test.describe.configure({ mode: "serial" });

const artifacts = "artifacts/sprint12";
const runId = Date.now();
const leadEmail = `pilot-${runId}@nova-sante.test`;

test.beforeAll(() => mkdirSync(artifacts, { recursive: true }));

test("landing desktop, CTA, preuve produit et capture du lead", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Pilotez votre développement en pharmacie." })).toBeVisible();
  await expect(page.getByText("De l’ouverture d’un compte au réassort, TR1 réunit le management et le terrain dans un même système.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Savoir où agir aujourd’hui." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Comprendre chaque pharmacie." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Donner au terrain la prochaine bonne action." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Recrutez, planifiez et mesurez vos animations." })).toBeVisible();
  await expect(page.locator("main > section")).toHaveCount(5);
  await expect(page.getByRole("link", { name: "Demander une démo" })).toHaveCount(2);

  await page.getByRole("link", { name: "Demander une démo" }).first().click();
  await expect(page.locator("#diagnostic")).toBeInViewport();
  await expect(page.getByRole("img", { name: "Expérience mobile Agent TR1" })).toBeVisible();
  await expect(page.getByRole("img", { name: "Planning TR1 des animations, formations et missions terrain" })).toBeVisible();
  await expect(page.getByText("Performance & rentabilité")).toBeVisible();
  await page.screenshot({ path: `${artifacts}/landing-desktop.png`, fullPage: true });

  await page.getByRole("button", { name: "Découvrir TR1 sur mon réseau officinal" }).click();
  await expect(page).toHaveURL(/\/#diagnostic$/);
  await expect(page.getByLabel("Nom et prénom")).toHaveAttribute("required", "");
  await page.getByLabel("Nom et prénom").fill("Marie Martin");
  await page.getByLabel("Email professionnel").fill(leadEmail.toUpperCase());
  await page.getByLabel("Marque ou laboratoire").fill("Nova Santé");
  await page.getByRole("button", { name: "Découvrir TR1 sur mon réseau officinal" }).click();
  await expect(page).toHaveURL(/\/merci$/);
  await expect(page.getByRole("heading", { name: /Merci/ })).toBeVisible();
  await page.screenshot({ path: `${artifacts}/thank-you-desktop.png`, fullPage: true });

  const { data: leads, error } = await adminClient().from("commercial_leads").select("professional_email,status").eq("professional_email", leadEmail);
  expect(error).toBeNull();
  expect(leads).toEqual([{ professional_email: leadEmail, status: "new" }]);
});

test("landing mobile reste lisible et sans débordement", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Pilotez votre développement en pharmacie." })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: `${artifacts}/landing-mobile.png`, fullPage: true });
});

test("pages légales signalées et page 404 publique", async ({ page }) => {
  await page.goto("/mentions-legales");
  await expect(page.getByRole("heading", { name: "Mentions légales" })).toBeVisible();
  await expect(page.getByText(/informations définitives requises/i)).toBeVisible();
  await page.goto("/politique-de-confidentialite");
  await expect(page.getByRole("heading", { name: "Politique de confidentialité" })).toBeVisible();
  await expect(page.getByText(/version de préparation/i)).toBeVisible();
  await page.goto("/page-inexistante-sprint-12-1");
  await expect(page.getByRole("heading", { name: "Page introuvable." })).toBeVisible();
});

test("responsable TR1 qualifie, attribue et prépare un pilote confirmé", async ({ page }) => {
  await signIn(page, "superadmin@tr1.local", /Dermavita/i);
  await page.goto(`/dashboard/admin/leads?q=${encodeURIComponent(leadEmail)}`);
  await page.getByRole("link", { name: "Nova Santé" }).click();
  await page.getByLabel("Statut").selectOption("qualified");
  await page.getByLabel("Responsable").selectOption({ label: "Sophie Martin" });
  await page.getByLabel("Prochaine action").fill("2026-09-01T10:00");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.locator(".tr1-da-eyebrow").first()).toHaveText("qualified");

  await page.getByRole("button", { name: "Préparer le pilote" }).click();
  await expect(page.getByRole("heading", { name: "Préparer un pilote" })).toBeVisible();
  await page.getByLabel("Utilisateurs").fill("12");
  await page.getByLabel("Démarrage proposé").fill("2026-09-15");
  await page.getByLabel("Je confirme la préparation explicite de ce brouillon.").check();
  await page.getByRole("button", { name: "Préparer le pilote" }).click();
  await expect(page.getByText("Statut :")).toContainText("draft");

  const client = adminClient();
  const { data: lead } = await client.from("commercial_leads").select("id,status,assigned_to").eq("professional_email", leadEmail).single();
  expect(lead?.status).toBe("pilot_proposed");
  expect(lead?.assigned_to).toBe("00000000-0000-0000-0000-0000000000a1");
  const { data: pilots } = await client.from("pilot_projects").select("status,organization_id,brand_id").eq("lead_id", lead!.id);
  expect(pilots).toEqual([{ status: "draft", organization_id: null, brand_id: null }]);
  const { data: events } = await client.from("commercial_lead_events").select("event_name").eq("lead_id", lead!.id);
  expect(events?.map((event) => event.event_name)).toEqual(expect.arrayContaining(["lead_created", "lead_assigned", "lead_status_changed", "next_action_changed", "pilot_prepared"]));
});

test("un utilisateur de marque ne peut pas ouvrir la console TR1", async ({ page }) => {
  await signIn(page, "admin@dermavita.local", /Dermavita/i);
  await page.goto("/dashboard/admin/leads");
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText("Leads TR1", { exact: true })).toHaveCount(0);
});

test("isolation, changement autorisé et marque sans membership", async ({ browser }) => {
  const agentApi = await userClient("agent@dermavita.local");
  const { data: hiddenPharmacies } = await agentApi.from("pharmacies").select("id").eq("trade_name", "Pharmacie Bellecour");
  expect(hiddenPharmacies).toEqual([]);

  const service = adminClient();
  const { data: role } = await service.from("roles").select("id").eq("key", "agent").single();
  await service.from("memberships").delete()
    .eq("user_id", "00000000-0000-0000-0000-0000000000a3")
    .eq("brand_id", "00000000-0000-0000-0000-000000000102");
  const { data: temporaryMembership, error: membershipError } = await service.from("memberships").insert({
    user_id: "00000000-0000-0000-0000-0000000000a3",
    organization_id: "00000000-0000-0000-0000-000000000003",
    brand_id: "00000000-0000-0000-0000-000000000102",
    role_id: role!.id,
    status: "active",
  }).select("id").single();
  expect(membershipError).toBeNull();

  const context = await browser.newContext();
  const page = await context.newPage();
  await signIn(page, "agent@dermavita.local", /Dermavita/i);
  await page.getByTitle("Changer de marque").click();
  await page.getByRole("button", { name: /Nutrilab/i }).click();
  await expect(page).toHaveURL(/\/dashboard\/agent$/);
  await expect(page.getByText("Nutrilab", { exact: true }).first()).toBeVisible();

  await service.from("product_events").delete()
    .eq("user_id", "00000000-0000-0000-0000-0000000000a3")
    .eq("brand_id", "00000000-0000-0000-0000-000000000102");
  await service.from("memberships").delete().eq("id", temporaryMembership!.id);
  await page.getByTitle("Changer de marque").click();
  await expect(page.getByRole("button", { name: /Nutrilab/i })).toHaveCount(0);
  await context.addCookies([{ name: "tr1_active_brand", value: "00000000-0000-0000-0000-000000000102", domain: "127.0.0.1", path: "/", httpOnly: true, sameSite: "Lax" }]);
  await page.goto("/dashboard/agent");
  await expect(page).toHaveURL(/\/select-brand/);
  await context.close();
});
