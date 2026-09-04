import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { adminClient, signIn, userClient } from "./test-helpers";

const brandId = "00000000-0000-0000-0000-000000000101";
const otherBrandId = "00000000-0000-0000-0000-000000000102";
const organizationId = "00000000-0000-0000-0000-000000000002";
const managerId = "00000000-0000-0000-0000-0000000000a2";
const territoryId = "00000000-0000-0000-0000-000000000201";
const productId = "00000000-0000-0000-0000-000000000601";
const suffix = Date.now().toString().slice(-6);
const pharmacyName = `Pharmacie Impact ${suffix}`;
const missionTitle = `Animation impact ${suffix}`;
const pharmacyId = randomUUID();
const relationId = randomUUID();
const missionId = randomUUID();
const recentMissionId = randomUUID();
const overlappingMissionId = randomUUID();
const recentMissionTitle = `Animation récente ${suffix}`;

async function createOrder(externalId: string, date: Date, type: "initial" | "reorder", amount: number) {
  const manager = await userClient("admin@dermavita.local");
  const { data: orderId, error } = await manager.rpc("create_order", {
    target_brand_pharmacy_id: relationId,
    order_payload: {
      external_order_id: externalId,
      order_status: "confirmed",
      order_type: type,
      order_date: date.toISOString(),
    },
    item_payload: [{ product_id: productId, quantity: 1, unit_price_ht: amount }],
  });
  expect(error).toBeNull();
  expect(orderId).toBeTruthy();

  const { error: invoicedError } = await manager.rpc("change_order_status", {
    target_order_id: orderId,
    target_status: "invoiced",
    reason: null,
  });
  expect(invoicedError).toBeNull();

  const { error: deliveredError } = await manager.rpc("change_order_status", {
    target_order_id: orderId,
    target_status: "delivered",
    reason: null,
  });
  expect(deliveredError).toBeNull();
}

async function createCompletedMissionFixture({
  id,
  missionType,
  title,
  objective,
  startAt,
  endAt,
  providerCostHt,
  travelCostHt = 0,
  reportPayload,
}: {
  id: string;
  missionType: "animation" | "training";
  title: string;
  objective: string;
  startAt: Date;
  endAt: Date;
  providerCostHt: number;
  travelCostHt?: number;
  reportPayload: Record<string, unknown>;
}) {
  const admin = adminClient();
  const providerId = "00000000-0000-0000-0000-0000000000a5";

  const { error: missionError } = await admin.from("missions").insert({
    id,
    organization_id: organizationId,
    brand_id: brandId,
    brand_pharmacy_id: relationId,
    pharmacy_id: pharmacyId,
    mission_type: missionType,
    status: "in_progress",
    title,
    objective,
    managed_by: managerId,
    created_by: managerId,
    assigned_user_id: providerId,
    scheduled_start_at: startAt.toISOString(),
    scheduled_end_at: endAt.toISOString(),
    actual_start_at: startAt.toISOString(),
    actual_end_at: endAt.toISOString(),
    provider_cost_ht: providerCostHt,
    travel_cost_ht: travelCostHt,
    source: "import",
  });
  expect(missionError).toBeNull();

  const provider = await userClient("animatrice@dermavita.local");
  const { data: reportId, error: reportError } = await provider.rpc("save_mission_report", {
    target_mission_id: id,
    report_payload: {
      report_status: "submitted",
      ...reportPayload,
    },
  });
  expect(reportError).toBeNull();
  expect(reportId).toBeTruthy();

  const tr1 = await userClient("superadmin@tr1.local");
  const { error: reviewError } = await tr1.rpc("review_mission_report", {
    target_report_id: reportId,
    target_status: "validated",
    reason: null,
  });
  expect(reviewError).toBeNull();
}

test.describe.serial("Sprint 10 — Performance des missions", () => {
  test.beforeAll(async () => {
    mkdirSync("artifacts/sprint10", { recursive: true });
    const admin = adminClient();
    const missionDate = new Date(Date.now() - 45 * 86_400_000);
    const { error: pharmacyError } = await admin.from("pharmacies").insert({
      id: pharmacyId,
      legal_name: `${pharmacyName} SAS`,
      trade_name: pharmacyName,
      siret: `10${suffix.padStart(12, "0")}`,
      postal_code: "75010",
      city: "Paris",
      created_by: managerId,
    });
    expect(pharmacyError).toBeNull();
    const { error: relationError } = await admin.from("brand_pharmacies").insert({
      id: relationId,
      brand_id: brandId,
      pharmacy_id: pharmacyId,
      commercial_status: "active",
      potential_level: "high",
      source: "tr1_prospecting",
      territory_id: territoryId,
      created_by: managerId,
    });
    expect(relationError).toBeNull();
    await createCompletedMissionFixture({
      id: missionId,
      missionType: "animation",
      title: missionTitle,
      objective: "Mesurer les résultats observés",
      startAt: new Date(missionDate.getTime() - 6 * 3_600_000),
      endAt: missionDate,
      providerCostHt: 200,
      travelCostHt: 50,
      reportPayload: {
        summary: "Animation menée avec résultats complets.",
        units_sold: 20,
        duration_minutes: 360,
        customer_contacts: 50,
        participant_count: 12,
        satisfaction_score: 90,
      },
    });

    const recentMissionDate = new Date(Date.now() - 10 * 86_400_000);
    await createCompletedMissionFixture({
      id: recentMissionId,
      missionType: "animation",
      title: recentMissionTitle,
      objective: "Observer une fenêtre encore immature",
      startAt: new Date(recentMissionDate.getTime() - 4 * 3_600_000),
      endAt: recentMissionDate,
      providerCostHt: 120,
      reportPayload: {
        summary: "Mission récente complète.",
        units_sold: 8,
        duration_minutes: 240,
        customer_contacts: 20,
      },
    });

    await createCompletedMissionFixture({
      id: overlappingMissionId,
      missionType: "training",
      title: `Formation proche ${suffix}`,
      objective: "Tester les interventions proches",
      startAt: new Date(missionDate.getTime() + 4 * 86_400_000),
      endAt: new Date(missionDate.getTime() + 5 * 86_400_000),
      providerCostHt: 100,
      reportPayload: {
        summary: "Formation menée avec participants documentés.",
        participant_count: 10,
      },
    });

    await createOrder(`S10-BEFORE-${suffix}`, new Date(missionDate.getTime() - 15 * 86_400_000), "initial", 100);
    await createOrder(`S10-AFTER-${suffix}`, new Date(missionDate.getTime() + 10 * 86_400_000), "reorder", 160);
    const { error: fixtureTaskError } = await admin.from("tasks").delete().eq("brand_pharmacy_id", relationId);
    expect(fixtureTaskError).toBeNull();
  });

  test("animation avec impact observé — coûts, commande, réassort et causalité", async ({ page }) => {
    await signIn(page, "admin@dermavita.local", /Dermavita/);
    const from = new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10);
    const to = new Date().toISOString().slice(0, 10);
    await page.goto(`/dashboard/network?view=missions&from=${from}&to=${to}`);
    await expect(page.getByRole("heading", { name: "Où en sommes-nous et où agir maintenant ?" })).toBeVisible();
    await expect(page.getByText(/sans causalité attribuée/i)).toBeVisible();
    const missionRow = page.getByRole("row").filter({ hasText: missionTitle });
    await expect(missionRow).toBeVisible();
    await expect(missionRow.getByText("Signal positif fort")).toBeVisible();
    await page.screenshot({ path: "artifacts/sprint10/mission-impact-dashboard-desktop.png", fullPage: true });
    await page.goto(`/dashboard/missions/${missionId}`);
    const impact = page.getByTestId("mission-impact");
    await expect(impact).toBeVisible();
    await expect(impact.getByText("Fenêtre J+30 complète")).toBeVisible();
    await expect(impact.getByText("20 unités", { exact: true })).toBeVisible();
    await expect(impact.getByText("CA J+30 observé").locator("..").getByText("160 €", { exact: true })).toBeVisible();
    await expect(impact.getByText(/Réassort observé sous 30 jours/)).toBeVisible();
    await expect(impact.getByText(/^Comparaison descriptive avant\/après mission/)).toBeVisible();
  });

  test("mission récente — résultat provisoire et fenêtres futures incomplètes", async ({ page }) => {
    await signIn(page, "admin@dermavita.local", /Dermavita/);
    await page.goto(`/dashboard/missions/${recentMissionId}`);
    const impact = page.getByTestId("mission-impact");
    await expect(impact.getByText("Résultat provisoire")).toBeVisible();
    await expect(impact.getByText("En cours d’observation")).toHaveCount(3);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: "artifacts/sprint10/mission-impact-recent-mobile.png", fullPage: true });
    const manager = await userClient("admin@dermavita.local");
    const { data } = await manager.rpc("get_mission_impact", { target_mission_id: recentMissionId });
    expect(data?.[0]).toMatchObject({ observation_maturity: "early", mission_effectiveness_status: "insufficient_data" });
  });

  test("missions chevauchantes — avertissement et aucune attribution automatique", async ({ page }) => {
    await signIn(page, "admin@dermavita.local", /Dermavita/);
    await page.goto(`/dashboard/missions/${missionId}`);
    const impact = page.getByTestId("mission-impact");
    await expect(impact.getByText("Interventions chevauchantes")).toBeVisible();
    await expect(impact.getByText(/Plusieurs interventions ont eu lieu/)).toBeVisible();
    await expect(impact.getByText(/attribu|généré par la mission/i)).toHaveCount(0);
    const manager = await userClient("admin@dermavita.local");
    const { data } = await manager.rpc("get_mission_impact", { target_mission_id: missionId });
    expect(data?.[0].overlapping_missions).toBe(true);
  });

  test("relance recommandée exige une création explicite et persiste en base", async ({ page }) => {
    const manager = await userClient("admin@dermavita.local");
    const { data: impactBefore, error: impactBeforeError } = await manager.rpc("get_mission_impact", {
      target_mission_id: recentMissionId,
    });
    expect(impactBeforeError).toBeNull();
    expect(impactBefore?.[0].followup_recommended).toBe(true);

    await signIn(page, "admin@dermavita.local", /Dermavita/);
    await page.goto(`/dashboard/missions/${recentMissionId}`);
    const form = page.getByTestId("mission-impact").locator("form");
    await form.locator('input[name="dueAt"]').fill("2026-12-01T10:00");
    await form.getByRole("button", { name: "Créer la tâche" }).click();

    const admin = adminClient();
    await expect.poll(async () => {
      const { count } = await admin
        .from("tasks")
        .select("*", { count: "exact", head: true })
        .eq("brand_pharmacy_id", relationId)
        .eq("title", `Suivi après mission — ${recentMissionTitle}`);
      return count;
    }).toBe(1);

    await expect.poll(async () => {
      const { data } = await manager.rpc("get_mission_impact", {
        target_mission_id: recentMissionId,
      });
      return data?.[0].followup_recommended;
    }).toBe(false);
  });

  test("autre marque et agent non affecté ne lisent ni RPC ni URL", async ({ page }) => {
    const otherManager = await userClient("admin@nutrilab.local");
    const { data: foreignRows } = await otherManager.rpc("get_mission_impact", { target_mission_id: missionId });
    expect(foreignRows).toEqual([]);
    const { error: dashboardError } = await otherManager.rpc("get_mission_impact_dashboard", {
      target_brand_id: brandId,
      target_period_days: 90,
      target_mission_type: null,
      target_assigned_user_id: null,
      target_brand_pharmacy_id: null,
    });
    expect(dashboardError?.message).toContain("forbidden");
    const agent = await userClient("agent@dermavita.local");
    const { data: agentRows } = await agent.rpc("get_mission_impact", { target_mission_id: missionId });
    expect(agentRows).toEqual([]);
    const { data: otherTenantRows } = await otherManager.from("mission_impact").select("mission_id").eq("brand_id", otherBrandId);
    expect(otherTenantRows?.some((row) => row.mission_id === missionId)).toBe(false);

    await signIn(page, "agent@dermavita.local", /Dermavita/);
    await page.goto(`/dashboard/missions/${missionId}`);
    await expect(page.getByText("404")).toBeVisible();
  });
});
