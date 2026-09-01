import { expect, test, type APIRequestContext } from "@playwright/test";
import { resolveNaturalDate } from "../src/lib/assistant/assistant-dates";
import { adminClient, signIn } from "./test-helpers";

const agentId = "00000000-0000-0000-0000-0000000000a3";
const dermavitaBrandId = "00000000-0000-0000-0000-000000000101";
const nutrilabBrandId = "00000000-0000-0000-0000-000000000102";
const republicRelationId = "00000000-0000-0000-0000-000000000411";
const phone = "+33612345678";
let sequence = 0;

async function simulate(
  request: APIRequestContext,
  text: string,
  options: { phone?: string; messageId?: string; type?: string } = {},
) {
  const providerMessageId = options.messageId ?? `sprint8-${Date.now()}-${sequence++}`;
  const response = await request.post("/api/integrations/whatsapp/simulate", {
    data: {
      providerMessageId,
      phone: options.phone ?? phone,
      type: options.type ?? "text",
      text,
    },
  });
  expect(response.ok(), await response.text()).toBe(true);
  return { providerMessageId, body: await response.json() as { duplicate: boolean; response: string | null; eventId?: string } };
}

test.describe.serial("Sprint 8 — Connecteur WhatsApp", () => {
  test.beforeAll(async () => {
    const admin = adminClient();
    await admin.from("assistant_contexts").delete().eq("user_id", agentId);
    await admin.from("assistant_action_drafts").delete().eq("user_id", agentId);
    await admin.from("communication_channels").delete().eq("user_id", agentId);
    await admin.from("whatsapp_link_tokens").delete().eq("user_id", agentId);
  });

  test("scénario 1 — linking sécurisé et affichage connecté", async ({ page, request }) => {
    await signIn(page, "agent@dermavita.local", /Dermavita/);
    await page.goto("/dashboard/account/whatsapp");
    await expect(page.getByRole("heading", { name: "Connecter WhatsApp" })).toBeVisible();
    await page.getByRole("button", { name: "Générer un code" }).click();
    const code = (await page.getByTestId("whatsapp-link-code").locator("p").nth(1).textContent())?.trim();
    expect(code).toMatch(/^TR1-[A-Z0-9]{6}$/);

    const linked = await simulate(request, code!);
    expect(linked.body.response).toContain("maintenant associé");

    await page.reload();
    await expect(page.getByText("Connecté", { exact: true })).toBeVisible();
    await expect(page.getByText("•• •• •• 56 78")).toBeVisible();
    await page.screenshot({ path: "artifacts/sprint8/whatsapp-linked-desktop.png", fullPage: true });

    const admin = adminClient();
    const { data: channel } = await admin.from("communication_channels")
      .select("user_id,normalized_identifier,revoked_at")
      .eq("normalized_identifier", phone)
      .single();
    expect(channel).toEqual({ user_id: agentId, normalized_identifier: phone, revoked_at: null });
  });

  test("scénario 2 — prochaine visite sans écriture métier", async ({ request }) => {
    const admin = adminClient();
    const { count: interactionCountBefore } = await admin.from("interactions").select("*", { count: "exact", head: true });
    const { count: taskCountBefore } = await admin.from("tasks").select("*", { count: "exact", head: true });

    const result = await simulate(request, "Quelle est ma prochaine visite ?");
    expect(result.body.response).toContain("Pharmacie République");
    expect(result.body.response).toContain("Visite de suivi Dermavita");
    expect(result.body.response).toContain("Waze : https://");
    expect(result.body.response).toContain("Maps : https://");

    const { count: interactionCountAfter } = await admin.from("interactions").select("*", { count: "exact", head: true });
    const { count: taskCountAfter } = await admin.from("tasks").select("*", { count: "exact", head: true });
    expect(interactionCountAfter).toBe(interactionCountBefore);
    expect(taskCountAfter).toBe(taskCountBefore);
  });

  test("scénario 3 — brouillon, confirmation idempotente et données finales", async ({ request }) => {
    const admin = adminClient();
    await admin.from("interactions").delete().eq("subject", "Compte rendu de visite");
    await admin.from("tasks").delete().like("title", "Suite : Compte rendu de visite%");
    await admin.from("assistant_contexts").delete().eq("user_id", agentId);
    await admin.from("assistant_action_drafts").delete().eq("user_id", agentId);

    const draftMessageId = `sprint8-draft-${Date.now()}`;
    const reminderMessage = "Visite terminée. Intérêt pour DREAM. La rappeler mardi prochain.";
    const expectedReminder = resolveNaturalDate(reminderMessage, { timezone: "Europe/Paris" });
    expect(expectedReminder).not.toBeNull();
    const draft = await simulate(
      request,
      reminderMessage,
      { messageId: draftMessageId },
    );
    expect(draft.body.response).toContain("Compte rendu préparé");
    expect(draft.body.response).toContain("Pharmacie République");
    expect(draft.body.response).toContain("1 — Confirmer");
    expect(draft.body.response).toContain(expectedReminder!.label);

    const duplicate = await simulate(
      request,
      reminderMessage,
      { messageId: draftMessageId },
    );
    expect(duplicate.body).toMatchObject({ duplicate: true, response: null });

    const { count: beforeConfirmation } = await admin.from("interactions")
      .select("*", { count: "exact", head: true })
      .eq("subject", "Compte rendu de visite");
    expect(beforeConfirmation).toBe(0);

    const confirmed = await simulate(request, "1");
    expect(confirmed.body.response).toContain("Compte rendu enregistré");

    const { data: interactions } = await admin.from("interactions")
      .select("id,brand_id,brand_pharmacy_id,notes,related_task_id")
      .eq("subject", "Compte rendu de visite");
    expect(interactions).toHaveLength(1);
    expect(interactions?.[0]).toMatchObject({
      brand_id: dermavitaBrandId,
      brand_pharmacy_id: republicRelationId,
      notes: "Intérêt pour DREAM.",
    });
    expect(interactions?.[0].related_task_id).toBeTruthy();

    const { data: tasks } = await admin.from("tasks")
      .select("id,assigned_to,due_at,related_interaction_id")
      .eq("related_interaction_id", interactions![0].id);
    expect(tasks).toHaveLength(1);
    expect(tasks?.[0].assigned_to).toBe(agentId);
    expect(new Date(tasks![0].due_at).toISOString()).toBe(expectedReminder!.iso);

    const confirmedAgain = await simulate(request, "1");
    expect(confirmedAgain.body.response).toContain("déjà été enregistrée");
    const { count: finalInteractionCount } = await admin.from("interactions")
      .select("*", { count: "exact", head: true })
      .eq("subject", "Compte rendu de visite");
    const { count: finalTaskCount } = await admin.from("tasks")
      .select("*", { count: "exact", head: true })
      .eq("related_interaction_id", interactions![0].id);
    expect(finalInteractionCount).toBe(1);
    expect(finalTaskCount).toBe(1);
  });

  test("scénario 4 — annulation sans écriture métier", async ({ request }) => {
    const admin = adminClient();
    const { count: before } = await admin.from("interactions")
      .select("*", { count: "exact", head: true })
      .eq("subject", "Compte rendu de visite");

    const draft = await simulate(request, "Visite terminée. Intérêt pour DREAM.");
    expect(draft.body.response).toContain("Compte rendu préparé");
    const cancelled = await simulate(request, "3");
    expect(cancelled.body.response).toContain("Aucune donnée métier n’a été enregistrée");

    const { count: after } = await admin.from("interactions")
      .select("*", { count: "exact", head: true })
      .eq("subject", "Compte rendu de visite");
    expect(after).toBe(before);
    const { data: latestDraft } = await admin.from("assistant_action_drafts")
      .select("status")
      .eq("user_id", agentId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    expect(latestDraft?.status).toBe("cancelled");
  });

  test("scénario 5 — numéro non associé sans fuite terrain", async ({ request }) => {
    const result = await simulate(request, "Bonjour", { phone: "+33699999999" });
    expect(result.body.response).toContain("pas encore associé");
    expect(result.body.response).toContain("Mon compte → Connecter WhatsApp");
    expect(result.body.response).not.toMatch(/Dermavita|Nutrilab|Pharmacie/i);
  });

  test("scénario 6 — isolation tenant puis révocation", async ({ page, request }) => {
    const admin = adminClient();
    const { count: interactionsBefore } = await admin.from("interactions")
      .select("*", { count: "exact", head: true })
      .eq("brand_id", nutrilabBrandId);
    const { count: tasksBefore } = await admin.from("tasks")
      .select("*", { count: "exact", head: true })
      .eq("brand_id", nutrilabBrandId);

    const denied = await simulate(request, "Résume-moi Pharmacie Bellecour");
    expect(denied.body.response).toContain("périmètre autorisé");
    expect(denied.body.response).not.toMatch(/Bellecour|Lyon|Nutrilab/i);

    const { count: interactionsAfter } = await admin.from("interactions")
      .select("*", { count: "exact", head: true })
      .eq("brand_id", nutrilabBrandId);
    const { count: tasksAfter } = await admin.from("tasks")
      .select("*", { count: "exact", head: true })
      .eq("brand_id", nutrilabBrandId);
    expect(interactionsAfter).toBe(interactionsBefore);
    expect(tasksAfter).toBe(tasksBefore);

    await signIn(page, "agent@dermavita.local", /Dermavita/);
    await page.goto("/dashboard/account/whatsapp");
    await page.getByRole("button", { name: "Déconnecter" }).click();
    await expect(page.getByText("Non connecté")).toBeVisible();

    const revoked = await simulate(request, "Quelle est ma prochaine visite ?");
    expect(revoked.body.response).toContain("pas encore associé");
    const { count: contexts } = await admin.from("assistant_contexts")
      .select("*", { count: "exact", head: true })
      .eq("user_id", agentId);
    expect(contexts).toBe(0);
  });
});
