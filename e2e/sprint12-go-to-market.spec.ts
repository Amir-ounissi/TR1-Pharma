import { mkdirSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { adminClient, signIn, userClient } from "./test-helpers";

test.describe.configure({ mode: "serial" });

const artifacts = "artifacts/sprint12";
const runId = Date.now();
const leadEmail = `pilot-${runId}@nova-sante.test`;
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

test("landing desktop, CTA, preuve produit et capture du lead", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Du sell-in au sell-out." })).toBeVisible();
  await expect(page.getByText("TR1 réunit visites commerciales, commandes, animations, formations et suivi du réseau dans un même cockpit terrain. Vos équipes savent où agir. Vous savez ce qui a été fait et ce qui doit suivre.")).toBeVisible();
  await expect(page.getByText("Démonstration", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: /Trois métiers.*Un même suivi/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Développez vos comptes." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Activez vos points de vente." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Accompagnez le conseil." })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Le terrain avance.*Vous savez où agir/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Né sur le terrain." })).toBeVisible();
  await expect(page.locator("main > section")).toHaveCount(5);
  await expect(page.getByRole("heading", { name: /Une action terrain avance/i })).toHaveCount(0);
  await expect(page.getByText("Essayez une question")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Demander une démo" })).toHaveCount(3);

  await expect(page.getByLabel("Exemple de priorités pour la marque")).toBeVisible();
  await expect(page.getByText("Quiz, scores et progression", { exact: true })).toBeVisible();
  await expect(page.getByRole("radiogroup")).toHaveCount(0);
  await page.screenshot({ path: `${artifacts}/landing-desktop.png`, fullPage: true });

  await page.getByRole("link", { name: "Demander une démo" }).first().click();
  await expect(page.locator("#diagnostic")).toBeInViewport();
  await expect(page.getByLabel("Nom et prénom")).toHaveAttribute("required", "");
  await page.getByLabel("Nom et prénom").fill("Marie Martin");
  await page.getByLabel("Email professionnel").fill(leadEmail.toUpperCase());
  await page.getByLabel("Marque ou laboratoire").fill("Nova Santé");
  await page.getByRole("button", { name: "Demander une démo" }).click();
  await expect(page).toHaveURL(/\/merci$/);
  await expect(page.getByRole("heading", { name: "Votre demande a bien été envoyée." })).toBeVisible();
  await page.screenshot({ path: `${artifacts}/thank-you-desktop.png`, fullPage: true });

  const { data: leads, error } = await adminClient().from("commercial_leads").select("professional_email,status").eq("professional_email", leadEmail);
  expect(error).toBeNull();
  expect(leads).toEqual([{ professional_email: leadEmail, status: "new" }]);
});

test("landing mobile reste lisible et sans débordement", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Du sell-in au sell-out." })).toBeVisible();
  await expect(page.getByRole("tablist", { name: "Choisir les informations affichées sur la carte" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Accompagnez le conseil." })).toBeVisible();
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
  await signIn(page, "superadmin@tr1.local", await primaryBrandName());
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
  await signIn(page, "admin@dermavita.local", await primaryBrandName());
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
  const nutrilabBrandId = "00000000-0000-0000-0000-000000000102";
  const nutrilabLink = () => page.locator(`a[href^="/auth/activate-brand?brandId=${nutrilabBrandId}"]`);

  try {
    await signIn(page, "agent@dermavita.local", await primaryBrandName());
    await page.goto("/dashboard/account");
    await expect(nutrilabLink()).toHaveCount(1);
    await nutrilabLink().click();
    await expect(page).toHaveURL(/\/dashboard\/agent$/);
    await expect(page.getByText("Nutrilab", { exact: true }).first()).toBeVisible();

    await service.from("product_events").delete()
      .eq("user_id", "00000000-0000-0000-0000-0000000000a3")
      .eq("brand_id", nutrilabBrandId);
    await service.from("memberships").delete().eq("id", temporaryMembership!.id);

    await page.goto("/dashboard/account");
    await expect(nutrilabLink()).toHaveCount(0);
    await context.addCookies([{ name: "tr1_active_brand", value: nutrilabBrandId, domain: "127.0.0.1", path: "/", httpOnly: true, sameSite: "Lax" }]);
    await page.goto("/dashboard/agent");
    // A stale inaccessible brand cookie is ignored without reintroducing a forced brand picker.
    await expect(page).toHaveURL(/\/dashboard\/agent$/);
    const fallbackBrandName = await primaryBrandName();
    await expect(page.getByText(`Ma journée · ${fallbackBrandName}`, { exact: true })).toBeVisible();
    await expect(page.getByText("Ma journée · Nutrilab", { exact: true })).toHaveCount(0);
  } finally {
    await service.from("product_events").delete()
      .eq("user_id", "00000000-0000-0000-0000-0000000000a3")
      .eq("brand_id", nutrilabBrandId);
    if (temporaryMembership?.id) {
      await service.from("memberships").delete().eq("id", temporaryMembership.id);
    }
    await context.close();
  }
});
