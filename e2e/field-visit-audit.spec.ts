import { expect, test } from "@playwright/test";
import { adminClient, signIn } from "./test-helpers";

const agentUserId = "00000000-0000-0000-0000-0000000000a3";
const brandId = "00000000-0000-0000-0000-000000000101";
const pharmacyId = "00000000-0000-0000-0000-000000000401";
const brandPharmacyId = "00000000-0000-0000-0000-000000000411";

const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlqY+0AAAAASUVORK5CYII=",
  "base64",
);

test("audit 4P+ terrain : snapshot, preuve, historique et action explicite", async ({ page }) => {
  const admin = adminClient();
  const runId = String(Date.now());
  const start = new Date(Date.now() + 25 * 86_400_000);
  start.setUTCHours(9, 0, 0, 0);
  const end = new Date(start.getTime() + 45 * 60_000);

  const { data: previousVisit, error: previousVisitError } = await admin
    .from("field_visits")
    .insert({
      owner_user_id: agentUserId,
      pharmacy_id: pharmacyId,
      visit_kind: "client_visit",
      status: "completed",
      title: `Audit précédent ${runId}`,
      objective: "Historique 4P+",
      scheduled_start_at: new Date(start.getTime() - 30 * 86_400_000).toISOString(),
      scheduled_end_at: new Date(end.getTime() - 30 * 86_400_000).toISOString(),
      source: "manual",
      created_by: agentUserId,
      completed_at: new Date(start.getTime() - 30 * 86_400_000).toISOString(),
    })
    .select("id")
    .single();
  expect(previousVisitError).toBeNull();

  const { data: visit, error: visitError } = await admin
    .from("field_visits")
    .insert({
      owner_user_id: agentUserId,
      pharmacy_id: pharmacyId,
      visit_kind: "client_visit",
      status: "planned",
      title: `Audit terrain ${runId}`,
      objective: "Valider l’audit 4P+",
      scheduled_start_at: start.toISOString(),
      scheduled_end_at: end.toISOString(),
      source: "manual",
      created_by: agentUserId,
    })
    .select("id")
    .single();
  expect(visitError).toBeNull();
  const previousVisitId = String(previousVisit!.id);
  const visitId = String(visit!.id);

  const { error: linksError } = await admin.from("field_visit_brands").insert([
    {
      visit_id: previousVisitId,
      brand_id: brandId,
      brand_pharmacy_id: brandPharmacyId,
      objective: "Historique 4P+",
      is_primary: true,
    },
    {
      visit_id: visitId,
      brand_id: brandId,
      brand_pharmacy_id: brandPharmacyId,
      objective: "Audit 4P+",
      is_primary: true,
    },
  ]);
  expect(linksError).toBeNull();

  const { error: previousAuditError } = await admin.from("field_visit_audits").insert({
    visit_id: previousVisitId,
    brand_id: brandId,
    brand_pharmacy_id: brandPharmacyId,
    created_by: agentUserId,
    price_displayed: true,
    displayed_price_ttc: 18.9,
    availability_status: "available",
    stock_quantity: 10,
    stock_count_mode: "counted",
    facings: 4,
    shelf_visibility: "high",
    plv_present: true,
    team_training_status: "trained",
    tester_samples_status: "present",
    competition_visible: false,
    recommendations: [],
    audited_at: new Date(start.getTime() - 30 * 86_400_000).toISOString(),
  });
  expect(previousAuditError).toBeNull();

  try {
    await signIn(page, "agent@dermavita.local", /Dermavita/i);
    await page.goto(`/dashboard/visits/${visitId}`);

    await expect(page.getByText("Audit express 4P+")).toBeVisible();
    await expect(page.getByText("Prérempli depuis le dernier audit. Modifiez uniquement ce qui a changé.")).toBeVisible();

    await page.locator('select[name="availabilityStatus"]').selectOption("stockout");
    await page.locator('input[name="stockQuantity"]').fill("0");
    await page.locator('select[name="stockCountMode"]').selectOption("counted");
    await page.locator('select[name="priceDisplayed"]').selectOption("false");
    await page.locator('input[name="displayedPriceTtc"]').fill("");
    await page.locator('input[name="facings"]').fill("0");
    await page.locator('select[name="shelfVisibility"]').selectOption("not_visible");
    await page.locator('select[name="plvPresent"]').selectOption("false");
    await page.locator('select[name="teamTrainingStatus"]').selectOption("not_trained");
    await page.locator('select[name="testerSamplesStatus"]').selectOption("missing");
    await page.locator('select[name="competitionVisible"]').selectOption("true");
    await page.locator('input[name="competitionNote"]').fill("Concurrent mis en avant");
    await page.locator('input[name="auditPhoto"]').setInputFiles({
      name: `audit-${runId}.png`,
      mimeType: "image/png",
      buffer: tinyPng,
    });
    await page.getByRole("button", { name: "Enregistrer l’audit" }).click();

    await expect(page.getByText(/Audit enregistré/)).toBeVisible({ timeout: 30_000 });

    const { data: audits, error: auditsError } = await admin
      .from("field_visit_audits")
      .select("id,availability_status,stock_quantity,facings,shelf_visibility,plv_present,team_training_status,recommendations")
      .eq("visit_id", visitId);
    expect(auditsError).toBeNull();
    expect(audits).toHaveLength(1);
    expect(audits?.[0]).toMatchObject({
      availability_status: "stockout",
      stock_quantity: 0,
      facings: 0,
      shelf_visibility: "not_visible",
      plv_present: false,
      team_training_status: "not_trained",
    });
    expect(audits?.[0].recommendations).toEqual(expect.arrayContaining(["reorder", "price", "plv", "training", "merchandising", "animation", "follow_up"]));

    const auditId = String(audits![0].id);
    const { data: attachments, error: attachmentsError } = await admin
      .from("field_visit_audit_attachments")
      .select("id,object_path,mime_type")
      .eq("audit_id", auditId)
      .is("archived_at", null);
    expect(attachmentsError).toBeNull();
    expect(attachments).toHaveLength(1);
    expect(attachments?.[0].mime_type).toBe("image/png");

    await page.getByText("Audit express 4P+").click();
    await expect(page.getByText("Depuis le passage précédent")).toBeVisible();
    await page.getByRole("button", { name: "Prévoir un réassort" }).click();
    await expect(page.getByText("Action ajoutée à vos tâches.")).toBeVisible();

    const dedupeKey = `audit_recommendation:${auditId}:reorder`;
    const { data: tasks, error: tasksError } = await admin
      .from("tasks")
      .select("id,task_type,action_code,trigger_id,dedupe_key")
      .eq("dedupe_key", dedupeKey)
      .is("archived_at", null);
    expect(tasksError).toBeNull();
    expect(tasks).toHaveLength(1);
    expect(tasks?.[0]).toMatchObject({
      task_type: "request_order",
      action_code: "audit_reorder",
      trigger_id: auditId,
      dedupe_key: dedupeKey,
    });
  } finally {
    const { data: auditRows } = await admin
      .from("field_visit_audits")
      .select("id")
      .in("visit_id", [visitId, previousVisitId]);
    const auditIds = (auditRows ?? []).map((row) => String(row.id));
    if (auditIds.length) {
      const { data: evidenceRows } = await admin
        .from("field_visit_audit_attachments")
        .select("object_path")
        .in("audit_id", auditIds)
        .is("archived_at", null);
      const paths = (evidenceRows ?? []).map((row) => String(row.object_path));
      if (paths.length) await admin.storage.from("audit-evidence").remove(paths);
      await admin.from("tasks").delete().in("trigger_id", auditIds);
    }
    await admin.from("field_visits").delete().in("id", [visitId, previousVisitId]);
  }
});
