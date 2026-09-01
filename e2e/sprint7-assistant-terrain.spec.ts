import { expect, test } from "@playwright/test";
import { adminClient, signIn, userClient } from "./test-helpers";

const brandId = "00000000-0000-0000-0000-000000000101";
const republicRelationId = "00000000-0000-0000-0000-000000000411";
const republicPharmacyId = "00000000-0000-0000-0000-000000000401";
const agentId = "00000000-0000-0000-0000-0000000000a3";

test.describe.serial("Sprint 7 — Assistant Terrain", () => {
  test("parcours principal avec confirmation unique et vérification en base", async ({ page }) => {
    const admin = adminClient();
    await admin.from("interactions").delete().eq("subject", "Compte rendu de visite");
    await admin.from("tasks").delete().like("title", "Suite : Compte rendu de visite%");

    await signIn(page, "agent@dermavita.local", /Dermavita/);
    await page.goto("/dashboard/agent/assistant");
    await expect(page.getByRole("heading", { name: "Assistant Terrain" })).toBeVisible();

    await page.getByLabel("Votre demande terrain").fill("Quelle est ma prochaine visite ?");
    await page.getByRole("button", { name: "Envoyer" }).click();
    await expect(page.getByText("Votre prochaine visite concerne Pharmacie République.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Waze" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Maps" })).toBeVisible();

    await page.getByLabel("Votre demande terrain").fill("Visite terminée. Intérêt pour DREAM. La rappeler mardi prochain.");
    await page.getByRole("button", { name: "Envoyer" }).click();
    const draft = page.getByTestId("assistant-draft");
    await expect(draft).toContainText("Pharmacie République");
    await expect(draft).toContainText("Intérêt pour DREAM.");
    await expect(draft).toContainText("Appel");
    await expect(draft).toContainText(/mardi/i);
    await expect(draft).toContainText(/\d{1,2}\s+[A-Za-zÀ-ÿ]+\s+\d{4}/i);

    await page.screenshot({ path: "artifacts/sprint7/assistant-desktop.png", fullPage: true });
    await draft.getByRole("button", { name: "Confirmer" }).click();
    await expect(page.getByText("Action confirmée et enregistrée.")).toBeVisible();

    const { data: interactions, error: interactionError } = await admin
      .from("interactions")
      .select("id,notes,related_task_id")
      .eq("brand_pharmacy_id", republicRelationId)
      .eq("subject", "Compte rendu de visite");
    expect(interactionError).toBeNull();
    expect(interactions).toHaveLength(1);
    expect(interactions?.[0].notes).toBe("Intérêt pour DREAM.");
    expect(interactions?.[0].related_task_id).toBeTruthy();

    const { data: tasks, error: taskError } = await admin
      .from("tasks")
      .select("id,task_type,assigned_to,related_interaction_id")
      .eq("related_interaction_id", interactions![0].id);
    expect(taskError).toBeNull();
    expect(tasks).toHaveLength(1);
    expect(tasks?.[0].task_type).toBe("call");
    expect(tasks?.[0].assigned_to).toBe(agentId);

    const { data: drafts } = await admin
      .from("assistant_action_drafts")
      .select("status,executed_action_id")
      .eq("executed_action_id", interactions![0].id);
    expect(drafts).toEqual([{ status: "confirmed", executed_action_id: interactions![0].id }]);

    await page.goto(`/dashboard/pharmacies/${republicRelationId}?tab=activity`);
    await expect(page.getByText("Intérêt pour DREAM.")).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dashboard/agent/assistant");
    await expect(page.getByRole("heading", { name: "Assistant Terrain" })).toBeVisible();
    await expect(page.getByLabel("Votre demande terrain")).toBeVisible();
    await page.screenshot({ path: "artifacts/sprint7/assistant-mobile-390.png", fullPage: true });
  });

  test("ambiguïté explicite puis annulation sans écriture métier", async ({ page }) => {
    const admin = adminClient();
    const pharmacyIds = [
      "00000000-0000-0000-0000-000000000491",
      "00000000-0000-0000-0000-000000000492",
    ];
    const relationIds = [
      "00000000-0000-0000-0000-000000000493",
      "00000000-0000-0000-0000-000000000494",
    ];
    await admin.from("pharmacy_assignments").delete().in("brand_pharmacy_id", relationIds);
    await admin.from("brand_pharmacies").delete().in("id", relationIds);
    await admin.from("pharmacies").delete().in("id", pharmacyIds);
    await admin.from("pharmacies").insert([
      { id: pharmacyIds[0], legal_name: "Pharmacie du Centre Paris", trade_name: "Pharmacie du Centre", address_line_1: "1 rue Centrale", postal_code: "75001", city: "Paris", created_by: agentId },
      { id: pharmacyIds[1], legal_name: "Pharmacie du Centre Boulogne", trade_name: "Pharmacie du Centre", address_line_1: "2 avenue Centrale", postal_code: "92100", city: "Boulogne-Billancourt", created_by: agentId },
    ]);
    await admin.from("brand_pharmacies").insert([
      { id: relationIds[0], brand_id: brandId, pharmacy_id: pharmacyIds[0], current_agent_user_id: agentId, source: "tr1_prospecting" },
      { id: relationIds[1], brand_id: brandId, pharmacy_id: pharmacyIds[1], current_agent_user_id: agentId, source: "tr1_prospecting" },
    ]);
    await admin.from("pharmacy_assignments").insert([
      { brand_id: brandId, brand_pharmacy_id: relationIds[0], user_id: agentId, assignment_type: "commercial_agent", is_primary: true, assigned_by: agentId },
      { brand_id: brandId, brand_pharmacy_id: relationIds[1], user_id: agentId, assignment_type: "commercial_agent", is_primary: true, assigned_by: agentId },
    ]);

    const { count: before } = await admin.from("interactions").select("*", { count: "exact", head: true }).in("brand_pharmacy_id", relationIds);
    await signIn(page, "agent@dermavita.local", /Dermavita/);
    await page.goto("/dashboard/agent/assistant");
    await page.getByLabel("Votre demande terrain").fill("Ajoute une note sur Pharmacie du Centre");
    await page.getByRole("button", { name: "Envoyer" }).click();
    await expect(page.getByText("J’ai trouvé plusieurs pharmacies correspondantes. Laquelle souhaitez-vous utiliser ?")).toBeVisible();
    await expect(page.getByRole("button", { name: /Pharmacie du Centre 1 rue Centrale · Paris/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Pharmacie du Centre 2 avenue Centrale · Boulogne-Billancourt/ })).toBeVisible();

    await page.getByRole("button", { name: /Pharmacie du Centre 1 rue Centrale · Paris/ }).click();
    const draft = page.getByTestId("assistant-draft");
    await expect(draft).toContainText("Pharmacie du Centre");
    await draft.getByRole("button", { name: "Annuler" }).click();
    await expect(page.getByText("Brouillon annulé. Aucune action métier n’a été créée.")).toBeVisible();

    const { count: after } = await admin.from("interactions").select("*", { count: "exact", head: true }).in("brand_pharmacy_id", relationIds);
    expect(after).toBe(before);
  });

  test("sécurité contre pharmacie, draft et marque hors périmètre", async () => {
    const agent = await userClient("agent@dermavita.local");
    const brandAdmin = await userClient("admin@dermavita.local");

    const { data: adminDraft, error: adminDraftError } = await brandAdmin.rpc("create_assistant_draft", {
      target_brand_id: brandId,
      target_brand_pharmacy_id: republicRelationId,
      target_action_type: "task",
      target_payload: {
        task_type: "call",
        title: "Draft tiers Sprint 7",
        due_at: "2026-08-05T09:00:00.000Z",
      },
      target_confidence: 0.9,
    });
    expect(adminDraftError).toBeNull();

    const { error: otherDraftError } = await agent.rpc("confirm_assistant_draft", {
      target_draft_id: adminDraft.id,
    });
    expect(otherDraftError?.message).toContain("Assistant draft forbidden");

    const { error: otherBrandError } = await agent.rpc("create_assistant_draft", {
      target_brand_id: "00000000-0000-0000-0000-000000000102",
      target_brand_pharmacy_id: "00000000-0000-0000-0000-000000000413",
      target_action_type: "task",
      target_payload: {
        task_type: "call",
        title: "Intrusion Nutrilab",
        due_at: "2026-08-05T09:00:00.000Z",
        brand_id: brandId,
      },
      target_confidence: 0.9,
    });
    expect(otherBrandError?.message).toContain("Assistant draft forbidden");

    const { error: unassignedError } = await agent.rpc("create_assistant_draft", {
      target_brand_id: brandId,
      target_brand_pharmacy_id: "00000000-0000-0000-0000-000000000412",
      target_action_type: "task",
      target_payload: {
        task_type: "call",
        title: "Intrusion pharmacie",
        due_at: "2026-08-05T09:00:00.000Z",
      },
      target_confidence: 0.9,
    });
    expect(unassignedError?.message).toContain("Assistant pharmacy forbidden");

    const admin = adminClient();
    const { count } = await admin.from("tasks").select("*", { count: "exact", head: true }).in("title", [
      "Draft tiers Sprint 7",
      "Intrusion Nutrilab",
      "Intrusion pharmacie",
    ]);
    expect(count).toBe(0);
    expect(republicPharmacyId).toBeTruthy();
  });
});
