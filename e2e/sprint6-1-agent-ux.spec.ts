import { expect, test } from "@playwright/test";
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
      title: `Visite UX 6.1 ${label} ${Date.now()}`,
      objective: "Clôture directe depuis Aujourd’hui",
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
    objective: "Clôture directe depuis Aujourd’hui",
    is_primary: true,
  });
  expect(brandError).toBeNull();
  return { admin, visitId };
}

test("Sprint 6.1 desktop — journée simplifiée et clôture directe", async ({ page }) => {
  const { admin, visitId } = await createTodayVisit("desktop");
  try {
    await signIn(page, "agent@dermavita.local", /Dermavita/i);
    await page.goto("/dashboard/agent");

    await expect(page.getByRole("heading", { name: "Ma journée", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Mon programme", exact: true })).toBeVisible();
    await expect(page.getByTestId("next-visit-card")).toHaveCount(0);
    await expect(page.getByTestId("active-visit-card")).toHaveCount(0);

    const link = page.locator(`a[href="/dashboard/visits/${visitId}"]`);
    await expect(link).toContainText("Pharmacie République");
    await expect(link).toContainText("Clôturer");
    await link.click();

    await expect(page.getByRole("heading", { name: "Clôturer la visite", exact: true })).toBeVisible();
    await expect(page.getByLabel("Résultat")).toBeVisible();
    await expect(page.getByLabel("Notes / compte rendu")).toBeVisible();
    await expect(page.locator('input[name="photos"]')).toHaveCount(1);
    await expect(page.getByText("Planifier la prochaine visite", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Démarrer la visite", exact: true })).toHaveCount(0);
  } finally {
    await admin.from("field_visits").delete().eq("id", visitId);
  }
});

test("Sprint 6.1 mobile — CTA clôturer accessible sans étape intermédiaire", async ({ page }) => {
  const { admin, visitId } = await createTodayVisit("mobile");
  try {
    await page.setViewportSize({ width: 390, height: 844 });
    await signIn(page, "agent@dermavita.local", /Dermavita/i);
    await page.goto("/dashboard/agent");

    const link = page.locator(`a[href="/dashboard/visits/${visitId}"]`);
    await expect(link).toBeVisible();
    await link.click();

    await expect(page.getByRole("heading", { name: "Clôturer la visite", exact: true })).toBeVisible();
    const submit = page.getByRole("button", { name: "Clôturer la visite", exact: true });
    await expect(submit).toBeVisible();

    const [navBox, submitBox] = await Promise.all([
      page.getByRole("navigation", { name: "Navigation mobile" }).boundingBox(),
      submit.boundingBox(),
    ]);
    expect(submitBox).not.toBeNull();
    expect(navBox).not.toBeNull();
    expect(submitBox!.y + submitBox!.height).toBeLessThanOrEqual(navBox!.y + 1);

    await page.screenshot({ path: "artifacts/sprint6-1/agent-ux-mobile-390.png", fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  } finally {
    await admin.from("field_visits").delete().eq("id", visitId);
  }
});
