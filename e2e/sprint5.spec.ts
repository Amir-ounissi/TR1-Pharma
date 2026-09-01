import { expect, test } from "@playwright/test";
import { adminClient, chooseCombobox, signIn, userClient } from "./test-helpers";

async function chooseWorkflow(page: import("@playwright/test").Page, option: string) {
  const form = page.getByRole("button", { name: "Mettre à jour" }).locator("..");
  await form.getByRole("combobox").click();
  await page.getByRole("option", { name: option }).click();
}

async function waitForMissionStatus(admin: ReturnType<typeof adminClient>, missionId: string, status: string) {
  await expect.poll(async () => {
    const { data } = await admin.from("missions").select("status").eq("id", missionId).single();
    return data?.status;
  }).toBe(status);
}

async function waitForReportStatus(admin: ReturnType<typeof adminClient>, missionId: string, status: string) {
  await expect.poll(async () => {
    const { data } = await admin.from("mission_reports").select("report_status").eq("mission_id", missionId).single();
    return data?.report_status;
  }).toBe(status);
}

test("parcours complet animation Sprint 5 avec vérification en base", async ({ browser }) => {
  const unique = Date.now();
  const title = `Animation E2E S5 ${unique}`;
  const orderNumber = `E2E-S5-${unique}`;
  const postMissionOrderDate = new Date(Date.now() + 86_400_000).toISOString().slice(0, 16);
  const briefing = "Présenter Dermacalm, vérifier la visibilité et documenter les objections.";
  const admin = adminClient();

  const tr1Context = await browser.newContext();
  const tr1Page = await tr1Context.newPage();
  await signIn(tr1Page, "superadmin@tr1.local", /Dermavita/i);
  await tr1Page.goto("/dashboard/missions/new");
  const creationForm = "form";
  await chooseCombobox(tr1Page, creationForm, 0, /Pharmacie République/i);
  await chooseCombobox(tr1Page, creationForm, 2, /Emma Laurent/i);
  await tr1Page.locator('input[name="title"]').fill(title);
  await tr1Page.locator('textarea[name="objective"]').fill("Mesurer le sell-out et la qualité de présentation.");
  await tr1Page.locator('textarea[name="briefing"]').fill(briefing);
  await tr1Page.locator('input[name="scheduledStartAt"]').fill("2026-07-21T08:00");
  await tr1Page.locator('input[name="scheduledEndAt"]').fill("2026-07-21T16:00");
  await tr1Page.getByText(/Dermacalm · DV-DC-50/i).click();
  await tr1Page.getByRole("button", { name: "Créer la mission" }).click();
  await expect(tr1Page).toHaveURL(/\/dashboard\/missions\/[0-9a-f-]{36}/);
  const missionUrl = new URL(tr1Page.url()).pathname;
  const missionId = missionUrl.split("/").at(-1)!;

  const animatorContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const animatorPage = await animatorContext.newPage();
  await signIn(animatorPage, "animatrice@dermavita.local", /Dermavita/i);
  await animatorPage.goto("/dashboard/field");
  await expect(animatorPage.getByRole("link", { name: new RegExp(title) })).toBeVisible();
  await animatorPage.getByRole("link", { name: new RegExp(title) }).click();
  await expect(animatorPage.getByText(briefing)).toBeVisible();
  await chooseWorkflow(animatorPage, "accepted");
  await animatorPage.getByRole("button", { name: "Mettre à jour" }).click();
  await waitForMissionStatus(admin, missionId, "accepted");

  await tr1Page.goto(missionUrl);
  await chooseWorkflow(tr1Page, "scheduled");
  await tr1Page.getByRole("button", { name: "Mettre à jour" }).click();
  await waitForMissionStatus(admin, missionId, "scheduled");

  await animatorPage.goto(missionUrl);
  await chooseWorkflow(animatorPage, "in_progress");
  await animatorPage.getByRole("button", { name: "Mettre à jour" }).click();
  await waitForMissionStatus(admin, missionId, "in_progress");
  await animatorPage.goto(missionUrl);
  await animatorPage.locator('input[type="file"]').setInputFiles({ name: "preuve-animation.png", mimeType: "image/png", buffer: Buffer.from("89504e470d0a1a0a", "hex") });
  await animatorPage.getByRole("button", { name: "Ajouter" }).click();
  await expect.poll(async () => {
    const { count } = await admin.from("mission_attachments").select("*", { count: "exact", head: true }).eq("mission_id", missionId);
    return count;
  }).toBe(1);
  await animatorPage.goto(missionUrl);

  await animatorPage.locator('textarea[name="summary"]').fill("Animation réalisée, premiers résultats disponibles.");
  await animatorPage.locator('input[name="unitsSold"]').fill("12");
  await animatorPage.locator('input[name="durationMinutes"]').fill("360");
  await animatorPage.locator('input[name="customerContacts"]').fill("48");
  await animatorPage.locator('input[name="netSalesTtc"]').fill("420");
  await animatorPage.getByRole("button", { name: "Enregistrer" }).click();
  await expect.poll(async () => {
    const { data } = await admin.from("mission_reports").select("summary").eq("mission_id", missionId).single();
    return data?.summary;
  }).toBe("Animation réalisée, premiers résultats disponibles.");
  await animatorPage.goto(missionUrl);
  await chooseWorkflow(animatorPage, "report_pending");
  await animatorPage.getByRole("button", { name: "Mettre à jour" }).click();
  await waitForMissionStatus(admin, missionId, "report_pending");
  await animatorPage.goto(missionUrl);
  const submitReport = animatorPage.getByRole("button", { name: "Soumettre" });
  await expect(submitReport).toBeEnabled();
  await submitReport.click();
  await waitForReportStatus(admin, missionId, "submitted");

  await tr1Page.goto("/dashboard/reports");
  const reportCard = tr1Page.locator(`[data-mission-id="${missionId}"]`);
  await reportCard.locator('input[name="reason"]').fill("Préciser les objections rencontrées.");
  await reportCard.getByRole("button", { name: "À corriger" }).click();
  await waitForReportStatus(admin, missionId, "needs_correction");

  await animatorPage.goto(missionUrl);
  await animatorPage.locator('textarea[name="summary"]').fill("Animation corrigée : objection principale liée au prix, équipe formée.");
  await animatorPage.getByRole("button", { name: "Soumettre" }).click();
  await waitForReportStatus(admin, missionId, "submitted");

  await tr1Page.goto("/dashboard/reports");
  await tr1Page.locator(`[data-mission-id="${missionId}"]`).getByRole("button", { name: "Valider" }).click();
  await waitForReportStatus(admin, missionId, "validated");
  await waitForMissionStatus(admin, missionId, "completed");
  await tr1Page.goto(missionUrl);
  await expect(tr1Page.getByText("Terminée", { exact: true }).first()).toBeVisible();

  await tr1Page.goto("/dashboard/orders/new");
  await chooseCombobox(tr1Page, "form", 0, /Pharmacie République/i);
  await tr1Page.locator('input[name="orderDate"]').fill(postMissionOrderDate);
  await chooseCombobox(tr1Page, "form", 1, "invoiced");
  await tr1Page.locator('input[name="orderNumber"]').fill(orderNumber);
  await chooseCombobox(tr1Page, "form", 4, /Dermacalm/i);
  await tr1Page.locator('input[name="quantity"]').fill("2");
  await tr1Page.locator('input[name="unitPriceHt"]').fill("18.50");
  await tr1Page.getByRole("button", { name: "Créer la commande" }).click();
  await expect.poll(async () => {
    const { count } = await admin.from("orders").select("*", { count: "exact", head: true }).eq("order_number", orderNumber);
    return count;
  }).toBe(1);
  await tr1Page.goto("/dashboard/mission-performance");
  await expect(tr1Page.getByText("37 €").first()).toBeVisible();
  console.info("Sprint 5 E2E: performance visible");

  const [missionResult, reportResult, attachmentsResult, interactionsResult, performanceResult] = await Promise.all([
    admin.from("missions").select("status,brand_id,assigned_user_id").eq("id", missionId).single(),
    admin.from("mission_reports").select("id,report_status,summary").eq("mission_id", missionId).single(),
    admin.from("mission_attachments").select("id,object_path,mime_type,archived_at").eq("mission_id", missionId),
    admin.from("interactions").select("id").eq("brand_pharmacy_id", "00000000-0000-0000-0000-000000000411").eq("subject", "Mission terrain validée"),
    admin.from("mission_performance").select("order_revenue_30d_ht,first_order_after_mission_at").eq("mission_id", missionId).single(),
  ]);
  expect([missionResult.error, reportResult.error, attachmentsResult.error, interactionsResult.error, performanceResult.error]).toEqual([null, null, null, null, null]);
  const mission = missionResult.data;
  const report = reportResult.data;
  const attachments = attachmentsResult.data;
  const interactions = interactionsResult.data;
  const performance = performanceResult.data;
  expect(mission).toMatchObject({ status: "completed", brand_id: "00000000-0000-0000-0000-000000000101", assigned_user_id: "00000000-0000-0000-0000-0000000000a5" });
  expect(report?.report_status).toBe("validated");
  expect(report?.summary).toContain("objection principale");
  expect(attachments).toHaveLength(1);
  expect(attachments?.[0].object_path).toMatch(new RegExp(`^00000000-0000-0000-0000-000000000101/${missionId}/`));
  expect(interactions?.length).toBeGreaterThan(0);
  expect(Number(performance?.order_revenue_30d_ht)).toBe(37);
  expect(performance?.first_order_after_mission_at).toBeTruthy();
  console.info("Sprint 5 E2E: database assertions passed");

  const otherBrandContext = await browser.newContext();
  const otherBrandPage = await otherBrandContext.newPage();
  await signIn(otherBrandPage, "admin@nutrilab.local", /Nutrilab/i);
  await otherBrandPage.goto(missionUrl);
  await expect(otherBrandPage.getByRole("heading", { name: "404", exact: true })).toBeVisible();
  console.info("Sprint 5 E2E: other brand denied");

  const otherAnimatorContext = await browser.newContext();
  const otherAnimatorPage = await otherAnimatorContext.newPage();
  await signIn(otherAnimatorPage, "autre-animatrice@dermavita.local", /Dermavita/i);
  await otherAnimatorPage.goto(missionUrl);
  await expect(otherAnimatorPage.getByRole("heading", { name: "404", exact: true })).toBeVisible();
  console.info("Sprint 5 E2E: other animator denied");
  const otherAnimator = await userClient("autre-animatrice@dermavita.local");
  expect((await otherAnimator.from("mission_reports").select("id").eq("mission_id", missionId)).data).toEqual([]);
  expect((await otherAnimator.from("mission_attachments").select("id").eq("mission_id", missionId)).data).toEqual([]);
  console.info("Sprint 5 E2E: direct RLS assertions passed");

  await Promise.all([tr1Context.close(), animatorContext.close(), otherBrandContext.close(), otherAnimatorContext.close()]);
  console.info("Sprint 5 E2E: contexts closed");
});
