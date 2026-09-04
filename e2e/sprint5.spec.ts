import { expect, test } from "@playwright/test";
import { adminClient, chooseCombobox, signIn, userClient } from "./test-helpers";

const relationId = "00000000-0000-0000-0000-000000000411";
const providerId = "00000000-0000-0000-0000-0000000000a5";

async function chooseWorkflow(
  page: import("@playwright/test").Page,
  option: RegExp | string,
) {
  const form = page.getByRole("button", { name: "Mettre à jour" }).locator("xpath=ancestor::form");
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

function localInput(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

test("parcours complet animation Sprint 5 avec vérification en base", async ({ browser }) => {
  const unique = Date.now();
  const title = `Animation E2E S5 ${unique}`;
  const orderNumber = `E2E-S5-${unique}`;
  const missionStart = new Date(Date.now() - 2 * 86_400_000);
  const missionEnd = new Date(missionStart.getTime() + 8 * 3_600_000);
  const postMissionOrderDate = localInput(new Date(Date.now() + 86_400_000));
  const briefing = "Présenter Dermacalm, vérifier la visibilité et documenter les objections.";
  const admin = adminClient();

  const tr1Context = await browser.newContext();
  const tr1Page = await tr1Context.newPage();
  await signIn(tr1Page, "superadmin@tr1.local", /Dermavita/i);
  await tr1Page.goto("/dashboard/missions/new");

  await chooseCombobox(tr1Page, "form", 0, /Pharmacie République/i);
  await tr1Page.locator('input[name="title"]').fill(title);
  await tr1Page.locator('textarea[name="objective"]').fill("Mesurer le sell-out et la qualité de présentation.");
  await tr1Page.locator('textarea[name="briefing"]').fill(briefing);
  await tr1Page.locator('input[name="scheduledStartAt"]').fill(localInput(missionStart));
  await tr1Page.locator('input[name="scheduledEndAt"]').fill(localInput(missionEnd));
  await tr1Page.getByText(/Dermacalm · DV-DC-50/i).click();
  await tr1Page.getByRole("button", { name: "Envoyer la demande de mission" }).click();

  await expect(tr1Page).toHaveURL(/\/dashboard\/missions\/[0-9a-f-]{36}/);
  const missionUrl = new URL(tr1Page.url()).pathname;
  const missionId = missionUrl.split("/").at(-1)!;
  await waitForMissionStatus(admin, missionId, "requested");

  await chooseWorkflow(tr1Page, "À affecter");
  await tr1Page.getByRole("button", { name: "Mettre à jour" }).click();
  await waitForMissionStatus(admin, missionId, "to_assign");

  await tr1Page.goto(missionUrl);
  await expect(tr1Page.getByText("Affecter l’intervenant", { exact: true })).toBeVisible();

  const tr1Client = await userClient("superadmin@tr1.local");
  const { error: assignmentError } = await tr1Client.rpc("assign_mission", {
    target_mission_id: missionId,
    target_user_id: providerId,
    target_scheduled_start_at: null,
    target_scheduled_end_at: null,
  });
  expect(assignmentError).toBeNull();
  await waitForMissionStatus(admin, missionId, "assigned");

  const animatorContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const animatorPage = await animatorContext.newPage();
  await signIn(animatorPage, "animatrice@dermavita.local", /Dermavita/i);
  await animatorPage.goto("/dashboard/field");
  await expect(animatorPage.getByRole("link", { name: new RegExp(title) })).toBeVisible();
  await animatorPage.getByRole("link", { name: new RegExp(title) }).click();
  await expect(animatorPage.getByText(briefing)).toBeVisible();

  await chooseWorkflow(animatorPage, "Acceptée");
  await animatorPage.getByRole("button", { name: "Mettre à jour" }).click();
  await waitForMissionStatus(admin, missionId, "accepted");

  await tr1Page.goto(missionUrl);
  await tr1Page.getByRole("button", { name: "Confirmer la planification" }).click();
  await waitForMissionStatus(admin, missionId, "scheduled");

  await animatorPage.goto(missionUrl);
  await chooseWorkflow(animatorPage, "En cours");
  await animatorPage.getByRole("button", { name: "Mettre à jour" }).click();
  await waitForMissionStatus(admin, missionId, "in_progress");

  await animatorPage.goto(missionUrl);
  await animatorPage.locator('input[type="file"]').setInputFiles({
    name: "preuve-animation.png",
    mimeType: "image/png",
    buffer: Buffer.from("89504e470d0a1a0a", "hex"),
  });
  await animatorPage.getByRole("button", { name: "Ajouter" }).click();
  await expect.poll(async () => {
    const { count } = await admin
      .from("mission_attachments")
      .select("*", { count: "exact", head: true })
      .eq("mission_id", missionId);
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
  const submitReport = animatorPage.getByRole("button", { name: "Soumettre à TR1" });
  await expect(submitReport).toBeEnabled();
  await submitReport.click();
  await waitForReportStatus(admin, missionId, "submitted");
  await waitForMissionStatus(admin, missionId, "report_pending");

  await tr1Page.goto("/dashboard/reports");
  const reportCard = tr1Page.locator(`[data-mission-id="${missionId}"]`);
  await reportCard.locator('input[name="reason"]').fill("Préciser les objections rencontrées.");
  await reportCard.getByRole("button", { name: "À corriger" }).click();
  await waitForReportStatus(admin, missionId, "needs_correction");

  await animatorPage.goto(missionUrl);
  await animatorPage.locator('textarea[name="summary"]').fill("Animation corrigée : objection principale liée au prix, équipe formée.");
  await animatorPage.getByRole("button", { name: "Soumettre à TR1" }).click();
  await waitForReportStatus(admin, missionId, "submitted");

  await tr1Page.goto("/dashboard/reports");
  await tr1Page.locator(`[data-mission-id="${missionId}"]`).getByRole("button", { name: "Valider" }).click();
  await waitForReportStatus(admin, missionId, "validated");
  await waitForMissionStatus(admin, missionId, "completed");

  await tr1Page.goto(missionUrl);
  await expect(tr1Page.getByText("Terminée", { exact: true }).first()).toBeVisible();

  await tr1Page.goto(`/dashboard/orders/new?pharmacy=${relationId}`);
  await tr1Page.locator('input[name="orderDate"]').fill(postMissionOrderDate);
  await tr1Page.getByLabel("Statut").click();
  await tr1Page.getByRole("option", { name: "Validée", exact: true }).click();
  await tr1Page.locator('input[name="orderNumber"]').fill(orderNumber);
  await tr1Page.getByLabel("Produit").click();
  await tr1Page.getByRole("option", { name: /Dermacalm/i }).click();
  await tr1Page.locator('input[name="quantity"]').fill("2");
  await tr1Page.locator('input[name="unitPriceHt"]').fill("18.50");
  await tr1Page.getByRole("button", { name: "Créer la commande" }).click();
  await expect(tr1Page.getByText("Commande créée et indicateurs recalculés.")).toBeVisible();

  const { data: createdOrder, error: createdOrderError } = await admin
    .from("orders")
    .select("id,order_status")
    .eq("order_number", orderNumber)
    .single();
  expect(createdOrderError).toBeNull();
  expect(createdOrder?.order_status).toBe("confirmed");

  const brandManager = await userClient("admin@dermavita.local");
  const { error: invoiceError } = await brandManager.rpc("change_order_status", {
    target_order_id: createdOrder!.id,
    target_status: "invoiced",
    reason: null,
  });
  expect(invoiceError).toBeNull();

  await tr1Page.goto("/dashboard/mission-performance");
  await expect(tr1Page).toHaveURL(/\/dashboard\/network\?view=missions/);

  const [missionResult, reportResult, attachmentsResult, interactionsResult, performanceResult] = await Promise.all([
    admin.from("missions").select("status,brand_id,assigned_user_id").eq("id", missionId).single(),
    admin.from("mission_reports").select("id,report_status,summary").eq("mission_id", missionId).single(),
    admin.from("mission_attachments").select("id,object_path,mime_type,archived_at").eq("mission_id", missionId),
    admin.from("interactions").select("id").eq("brand_pharmacy_id", relationId).eq("subject", "Mission terrain validée"),
    admin.from("mission_performance").select("order_revenue_30d_ht,first_order_after_mission_at").eq("mission_id", missionId).single(),
  ]);

  expect([
    missionResult.error,
    reportResult.error,
    attachmentsResult.error,
    interactionsResult.error,
    performanceResult.error,
  ]).toEqual([null, null, null, null, null]);

  expect(missionResult.data).toMatchObject({
    status: "completed",
    brand_id: "00000000-0000-0000-0000-000000000101",
    assigned_user_id: providerId,
  });
  expect(reportResult.data?.report_status).toBe("validated");
  expect(reportResult.data?.summary).toContain("objection principale");
  expect(attachmentsResult.data).toHaveLength(1);
  expect(attachmentsResult.data?.[0].object_path).toMatch(
    new RegExp(`^00000000-0000-0000-0000-000000000101/${missionId}/`),
  );
  expect(interactionsResult.data?.length).toBeGreaterThan(0);
  expect(Number(performanceResult.data?.order_revenue_30d_ht)).toBe(37);
  expect(performanceResult.data?.first_order_after_mission_at).toBeTruthy();

  const otherBrandContext = await browser.newContext();
  const otherBrandPage = await otherBrandContext.newPage();
  await signIn(otherBrandPage, "admin@nutrilab.local", /Nutrilab/i);
  await otherBrandPage.goto(missionUrl);
  await expect(otherBrandPage.getByRole("heading", { name: "404", exact: true })).toBeVisible();

  const otherAnimatorContext = await browser.newContext();
  const otherAnimatorPage = await otherAnimatorContext.newPage();
  await signIn(otherAnimatorPage, "autre-animatrice@dermavita.local", /Dermavita/i);
  await otherAnimatorPage.goto(missionUrl);
  await expect(otherAnimatorPage.getByRole("heading", { name: "404", exact: true })).toBeVisible();

  const otherAnimator = await userClient("autre-animatrice@dermavita.local");
  expect((await otherAnimator.from("mission_reports").select("id").eq("mission_id", missionId)).data).toEqual([]);
  expect((await otherAnimator.from("mission_attachments").select("id").eq("mission_id", missionId)).data).toEqual([]);

  await Promise.all([
    tr1Context.close(),
    animatorContext.close(),
    otherBrandContext.close(),
    otherAnimatorContext.close(),
  ]);
});
