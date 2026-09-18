import { expect, test } from "@playwright/test";
import { adminClient, signIn, userClient } from "./test-helpers";

const agentUserId = "00000000-0000-0000-0000-0000000000a3";
const dermavitaBrandId = "00000000-0000-0000-0000-000000000101";
const republiquePharmacyId = "00000000-0000-0000-0000-000000000401";
const republiqueBrandPharmacyId = "00000000-0000-0000-0000-000000000411";

const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlqY+0AAAAASUVORK5CYII=",
  "base64",
);

test("golden path visite : accès direct, compte rendu, preuve et clôture idempotente", async ({ page }) => {
  const admin = adminClient();
  const runId = String(Date.now());
  const summary = `Golden path visite ${runId}`;
  const scheduledStart = new Date(Date.now() + 30 * 86_400_000);
  scheduledStart.setUTCHours(9, 0, 0, 0);
  const scheduledEnd = new Date(scheduledStart.getTime() + 45 * 60_000);

  const { data: visit, error: visitError } = await admin
    .from("field_visits")
    .insert({
      owner_user_id: agentUserId,
      pharmacy_id: republiquePharmacyId,
      visit_kind: "client_visit",
      status: "planned",
      title: `Visite Golden Path ${runId}`,
      objective: "Valider le workflow de clôture terrain",
      scheduled_start_at: scheduledStart.toISOString(),
      scheduled_end_at: scheduledEnd.toISOString(),
      source: "manual",
      created_by: agentUserId,
    })
    .select("id")
    .single();
  expect(visitError).toBeNull();
  expect(visit?.id).toBeTruthy();
  const visitId = String(visit!.id);

  const { error: brandError } = await admin.from("field_visit_brands").insert({
    visit_id: visitId,
    brand_id: dermavitaBrandId,
    brand_pharmacy_id: republiqueBrandPharmacyId,
    objective: "Valider le workflow de clôture terrain",
    is_primary: true,
  });
  expect(brandError).toBeNull();

  try {
    await signIn(page, "agent@dermavita.local", /Dermavita/i);
    await page.goto(`/dashboard/pharmacies/${republiqueBrandPharmacyId}`);

    const terrainHeader = page.getByTestId("terrain-pharmacy-header");
    await terrainHeader.getByRole("button", { name: "Visite", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/dashboard/visits/${visitId}#visit-executionimport { expect, test } from "@playwright/test";
import { adminClient, signIn, userClient } from "./test-helpers";

const agentUserId = "00000000-0000-0000-0000-0000000000a3";
const dermavitaBrandId = "00000000-0000-0000-0000-000000000101";
const republiquePharmacyId = "00000000-0000-0000-0000-000000000401";
const republiqueBrandPharmacyId = "00000000-0000-0000-0000-000000000411";

const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlqY+0AAAAASUVORK5CYII=",
  "base64",
);

test("golden path visite : accès direct, compte rendu, preuve et clôture idempotente", async ({ page }) => {
  const admin = adminClient();
  const runId = String(Date.now());
  const summary = `Golden path visite ${runId}`;
  const scheduledStart = new Date(Date.now() + 30 * 86_400_000);
  scheduledStart.setUTCHours(9, 0, 0, 0);
  const scheduledEnd = new Date(scheduledStart.getTime() + 45 * 60_000);

  const { data: visit, error: visitError } = await admin
    .from("field_visits")
    .insert({
      owner_user_id: agentUserId,
      pharmacy_id: republiquePharmacyId,
      visit_kind: "client_visit",
      status: "planned",
      title: `Visite Golden Path ${runId}`,
      objective: "Valider le workflow de clôture terrain",
      scheduled_start_at: scheduledStart.toISOString(),
      scheduled_end_at: scheduledEnd.toISOString(),
      source: "manual",
      created_by: agentUserId,
    })
    .select("id")
    .single();
  expect(visitError).toBeNull();
  expect(visit?.id).toBeTruthy();
  const visitId = String(visit!.id);

  const { error: brandError } = await admin.from("field_visit_brands").insert({
    visit_id: visitId,
    brand_id: dermavitaBrandId,
    brand_pharmacy_id: republiqueBrandPharmacyId,
    objective: "Valider le workflow de clôture terrain",
    is_primary: true,
  });
  expect(brandError).toBeNull();

  try {
));

    await expect(page.getByRole("heading", { name: "Pharmacie République" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Clôturer la visite", exact: true })).toBeVisible();

    await page.locator('select[name="outcome"]').selectOption("follow_up");
    await page.getByLabel("Notes / compte rendu").fill(summary);
    await page.locator('input[name="photos"]').setInputFiles({
      name: `preuve-${runId}.png`,
      mimeType: "image/png",
      buffer: tinyPng,
    });
    await page.getByRole("button", { name: "Clôturer la visite", exact: true }).click();

    await expect(page.getByRole("heading", { name: "Visite clôturée" })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(summary)).toBeVisible();

    const { data: persistedVisit, error: persistedVisitError } = await admin
      .from("field_visits")
      .select("status,started_at,completed_at,actual_start_at,actual_end_at")
      .eq("id", visitId)
      .single();
    expect(persistedVisitError).toBeNull();
    expect(persistedVisit?.status).toBe("completed");
    expect(persistedVisit?.started_at).toBeTruthy();
    expect(persistedVisit?.completed_at).toBeTruthy();
    expect(persistedVisit?.actual_start_at).toBeTruthy();
    expect(persistedVisit?.actual_end_at).toBeTruthy();

    const { data: closeouts, error: closeoutsError } = await admin
      .from("field_visit_closeouts")
      .select("id,outcome,summary")
      .eq("visit_id", visitId);
    expect(closeoutsError).toBeNull();
    expect(closeouts).toHaveLength(1);
    expect(closeouts?.[0]).toMatchObject({ outcome: "follow_up", summary });

    const { data: interactions, error: interactionsError } = await admin
      .from("interactions")
      .select("id,brand_id,brand_pharmacy_id,interaction_type,notes,field_visit_id")
      .eq("field_visit_id", visitId)
      .eq("interaction_type", "visit");
    expect(interactionsError).toBeNull();
    expect(interactions).toHaveLength(1);
    expect(interactions?.[0]).toMatchObject({
      brand_id: dermavitaBrandId,
      brand_pharmacy_id: republiqueBrandPharmacyId,
      interaction_type: "visit",
      notes: summary,
      field_visit_id: visitId,
    });

    const interactionId = String(interactions![0].id);
    const { data: attachments, error: attachmentsError } = await admin
      .from("interaction_attachments")
      .select("id,interaction_id,brand_id,object_path,mime_type")
      .eq("interaction_id", interactionId)
      .is("archived_at", null);
    expect(attachmentsError).toBeNull();
    expect(attachments).toHaveLength(1);
    expect(attachments?.[0]).toMatchObject({
      interaction_id: interactionId,
      brand_id: dermavitaBrandId,
      mime_type: "image/png",
    });
    expect(attachments?.[0].object_path).toBe(`${dermavitaBrandId}/${interactionId}/closeout-1.png`);

    const agent = await userClient("agent@dermavita.local");
    const { data: retry, error: retryError } = await agent.rpc("close_field_visit", {
      target_visit_id: visitId,
      closeout_payload: {
        outcome: "follow_up",
        summary,
        input_mode: "manual",
        structured_payload: {},
        next_visit_at: null,
        next_objective: null,
      },
    });
    expect(retryError).toBeNull();
    expect(retry).toMatchObject({ already_closed: true });

    const [{ count: closeoutCount }, { count: interactionCount }, { count: attachmentCount }] = await Promise.all([
      admin.from("field_visit_closeouts").select("id", { count: "exact", head: true }).eq("visit_id", visitId),
      admin.from("interactions").select("id", { count: "exact", head: true }).eq("field_visit_id", visitId).eq("interaction_type", "visit"),
      admin.from("interaction_attachments").select("id", { count: "exact", head: true }).eq("interaction_id", interactionId).is("archived_at", null),
    ]);
    expect(closeoutCount).toBe(1);
    expect(interactionCount).toBe(1);
    expect(attachmentCount).toBe(1);
  } finally {
    const { data: interactions } = await admin
      .from("interactions")
      .select("id")
      .eq("field_visit_id", visitId);
    const interactionIds = (interactions ?? []).map((row) => String(row.id));
    if (interactionIds.length) {
      const { data: attachments } = await admin
        .from("interaction_attachments")
        .select("object_path")
        .in("interaction_id", interactionIds);
      const paths = (attachments ?? []).map((row) => String(row.object_path));
      if (paths.length) await admin.storage.from("interaction-evidence").remove(paths);
      await admin.from("interactions").delete().in("id", interactionIds);
    }
    await admin.from("field_visits").delete().eq("id", visitId);
  }
});
