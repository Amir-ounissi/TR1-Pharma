import { expect, test, type Browser, type Page } from "@playwright/test";
import { adminClient, signIn } from "./test-helpers";

const agentUserId = "00000000-0000-0000-0000-0000000000a3";
const dermavitaBrandId = "00000000-0000-0000-0000-000000000101";
const republiquePharmacyId = "00000000-0000-0000-0000-000000000401";
const republiqueBrandPharmacyId = "00000000-0000-0000-0000-000000000411";

async function createTodayVisit(label: string) {
  const admin = adminClient();
  const start = new Date();
  const end = new Date(start.getTime() + 30 * 60_000);
  const { data: visit, error } = await admin
    .from("field_visits")
    .insert({
      owner_user_id: agentUserId,
      pharmacy_id: republiquePharmacyId,
      visit_kind: "client_visit",
      status: "planned",
      title: `Visite UX ${label} ${Date.now()}`,
      objective: "Valider le parcours de clôture directe",
      scheduled_start_at: start.toISOString(),
      scheduled_end_at: end.toISOString(),
      source: "manual",
      created_by: agentUserId,
    })
    .select("id")
    .single();
  expect(error).toBeNull();
  const visitId = String(visit!.id);
  const { error: brandError } = await admin.from("field_visit_brands").insert({
    visit_id: visitId,
    brand_id: dermavitaBrandId,
    brand_pharmacy_id: republiqueBrandPharmacyId,
    objective: "Valider le parcours de clôture directe",
    is_primary: true,
  });
  expect(brandError).toBeNull();
  return { admin, visitId };
}

async function openTodayVisit(page: Page, visitId: string) {
  await signIn(page, "agent@dermavita.local", /Dermavita/i);
  await page.goto("/dashboard/agent");

  await expect(page.getByRole("heading", { name: "Ma journée", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Mon programme", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Démarrer", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Terminer la visite", exact: true })).toHaveCount(0);

  const visitLink = page.locator(`a[href="/dashboard/visits/${visitId}"]`);
  await expect(visitLink).toBeVisible();
  await expect(visitLink).toContainText("Pharmacie République");
  await expect(visitLink).toContainText("Clôturer");
  await visitLink.click();

  await expect(page.getByRole("heading", { name: "Pharmacie République" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Clôturer la visite", exact: true })).toBeVisible();
  await expect(page.getByLabel("Notes / compte rendu")).toBeVisible();
  await expect(page.getByRole("button", { name: "Clôturer la visite", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Démarrer la visite", exact: true })).toHaveCount(0);
}

async function runAgentDay(browser: Browser, viewport: { width: number; height: number }, label: string) {
  const { admin, visitId } = await createTodayVisit(label);
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  try {
    await openTodayVisit(page, visitId);
    return { context, page, admin, visitId };
  } catch (error) {
    await context.close();
    await admin.from("field_visits").delete().eq("id", visitId);
    throw error;
  }
}

test("Sprint 6 Agent Day desktop — visite ouverte directement sur la clôture", async ({ browser }) => {
  const { context, page, admin, visitId } = await runAgentDay(browser, { width: 1440, height: 1000 }, "desktop");
  try {
    await page.screenshot({ path: "artifacts/sprint6/agent-day-desktop.png", fullPage: true });
  } finally {
    await context.close();
    await admin.from("field_visits").delete().eq("id", visitId);
  }
});

test("Sprint 6 Agent Day mobile — parcours terrain sans bouton démarrer", async ({ browser }) => {
  const { context, page, admin, visitId } = await runAgentDay(browser, { width: 390, height: 844 }, "mobile");
  try {
    await page.screenshot({ path: "artifacts/sprint6/agent-day-mobile-390.png", fullPage: true });

    for (const width of [375, 390, 430]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto("/dashboard/agent");
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `no horizontal overflow at ${width}px`).toBeLessThanOrEqual(1);
      await expect(page.getByRole("heading", { name: "Mon programme", exact: true })).toBeVisible();
      await expect(page.locator(`a[href="/dashboard/visits/${visitId}"]`)).toBeVisible();
      await expect(page.getByRole("button", { name: "Démarrer", exact: true })).toHaveCount(0);
    }
  } finally {
    await context.close();
    await admin.from("field_visits").delete().eq("id", visitId);
  }
});
