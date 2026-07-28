import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { adminClient, signIn, userClient } from "./test-helpers";

const dermavitaBrandId = "00000000-0000-0000-0000-000000000101";
const nutrilabBrandId = "00000000-0000-0000-0000-000000000102";
const productId = "00000000-0000-0000-0000-000000000601";
const managerId = "00000000-0000-0000-0000-0000000000a2";
const agentId = "00000000-0000-0000-0000-0000000000a3";
const territoryId = "00000000-0000-0000-0000-000000000201";
const runSuffix = Date.now().toString().slice(-6);
const agentPharmacyName = `Pharmacie Sprint 9 Agent ${runSuffix}`;
const conversionPharmacyName = `Pharmacie Sprint 9 Conversion ${runSuffix}`;
let agentRelationId: string;
let conversionRelationId: string;

async function createFinalizedOrder(
  relationId: string,
  externalId: string,
  orderDate: string,
) {
  const manager = await userClient("admin@dermavita.local");
  const { data, error } = await manager.rpc("create_order", {
    target_brand_pharmacy_id: relationId,
    order_payload: {
      external_order_id: externalId,
      order_status: "delivered",
      order_date: orderDate,
    },
    item_payload: [{ product_id: productId, quantity: 4, unit_price_ht: 25 }],
  });
  expect(error).toBeNull();
  expect(data).toBeTruthy();
}

test.describe.serial("Sprint 9 — Pilotage commercial et réassort", () => {
  test.beforeAll(async () => {
    const admin = adminClient();
    const agentPharmacyId = randomUUID();
    const conversionPharmacyId = randomUUID();
    agentRelationId = randomUUID();
    conversionRelationId = randomUUID();
    const { error: pharmacyError } = await admin.from("pharmacies").insert([
      {
        id: agentPharmacyId,
        legal_name: `${agentPharmacyName} SAS`,
        trade_name: agentPharmacyName,
        siret: `91${runSuffix.padStart(12, "0")}`,
        address_line_1: "9 rue du Réassort",
        postal_code: "75009",
        city: "Paris",
        created_by: managerId,
      },
      {
        id: conversionPharmacyId,
        legal_name: `${conversionPharmacyName} SAS`,
        trade_name: conversionPharmacyName,
        siret: `92${runSuffix.padStart(12, "0")}`,
        address_line_1: "10 rue du Réassort",
        postal_code: "75010",
        city: "Paris",
        created_by: managerId,
      },
    ]);
    expect(pharmacyError).toBeNull();
    const { error: relationError } = await admin.from("brand_pharmacies").insert([
      {
        id: agentRelationId,
        brand_id: dermavitaBrandId,
        pharmacy_id: agentPharmacyId,
        commercial_status: "active",
        activity_status: "active",
        priority_level: "strategic",
        potential_level: "very_high",
        source: "tr1_prospecting",
        current_agent_user_id: agentId,
        territory_id: territoryId,
        created_by: managerId,
      },
      {
        id: conversionRelationId,
        brand_id: dermavitaBrandId,
        pharmacy_id: conversionPharmacyId,
        commercial_status: "implanted",
        activity_status: "active",
        priority_level: "normal",
        potential_level: "medium",
        source: "tr1_prospecting",
        territory_id: territoryId,
        created_by: managerId,
      },
    ]);
    expect(relationError).toBeNull();
    const { error: assignmentError } = await admin.from("pharmacy_assignments").insert({
      brand_id: dermavitaBrandId,
      brand_pharmacy_id: agentRelationId,
      user_id: agentId,
      assignment_type: "commercial_agent",
      is_primary: true,
      assignment_reason: "E2E Sprint 9",
      assigned_by: managerId,
    });
    expect(assignmentError).toBeNull();

    const now = Date.now();
    await createFinalizedOrder(
      agentRelationId,
      `S9-E2E-AGENT-${runSuffix}`,
      new Date(now - 90 * 86_400_000).toISOString(),
    );
    await createFinalizedOrder(
      conversionRelationId,
      `S9-E2E-CONVERSION-${runSuffix}`,
      new Date(now - 70 * 86_400_000).toISOString(),
    );
  });

  test("manager — décision, détail explicable et relance confirmée", async ({ page }) => {
    await signIn(page, "admin@dermavita.local", /Dermavita/);
    await expect(page.getByRole("heading", { name: "Où agir maintenant ?" })).toBeVisible();
    await expect(page.getByText("À traiter maintenant")).toBeVisible();
    await page.screenshot({ path: "artifacts/sprint9/manager-dashboard-desktop.png", fullPage: true });

    await expect(page.getByRole("link", { name: /Voir toutes les priorités/ })).toHaveAttribute("href", "/dashboard/commercial-health");
    await page.goto("/dashboard/commercial-health");
    await expect(page.getByRole("heading", { name: "Priorités commerciales" })).toBeVisible();
    const conversionSection = page.locator("section").filter({ hasText: "Implantations à convertir" });
    const conversionCard = conversionSection.locator('[data-slot="card"]').filter({ hasText: conversionPharmacyName });
    await expect(conversionCard).toBeVisible();
    await expect(conversionCard.getByRole("link", { name: "Ouvrir le compte" })).toHaveAttribute("href", `/dashboard/pharmacies/${conversionRelationId}`);
    await page.goto(`/dashboard/pharmacies/${conversionRelationId}`);

    await expect(page.getByRole("heading", { name: conversionPharmacyName })).toBeVisible();
    const health = page.getByTestId("commercial-health-summary");
    await expect(health.getByText("Santé commerciale")).toBeVisible();
    await expect(health.getByText("Dernière commande")).toBeVisible();
    await expect(health.getByText("Réassort estimé")).toBeVisible();
    await expect(health.getByText("À convertir")).toBeVisible();
    await health.getByText("Créer la relance").click();
    await health.getByRole("button", { name: "Confirmer la création" }).click();

    const admin = adminClient();
    await expect.poll(async () => {
      const { count } = await admin
        .from("tasks")
        .select("*", { count: "exact", head: true })
        .eq("brand_pharmacy_id", conversionRelationId)
        .eq("title", `Relance réassort — ${conversionPharmacyName}`);
      return count;
    }).toBe(1);
    const { data: tasks } = await admin
      .from("tasks")
      .select("brand_id,brand_pharmacy_id,title,due_at,status")
      .eq("brand_pharmacy_id", conversionRelationId)
      .eq("title", `Relance réassort — ${conversionPharmacyName}`);
    expect(tasks).toHaveLength(1);
    expect(tasks?.[0]).toMatchObject({
      brand_id: dermavitaBrandId,
      brand_pharmacy_id: conversionRelationId,
      status: "open",
    });
  });

  test("premier réassort — conversion visible dans les données finales", async ({ page }) => {
    await createFinalizedOrder(
      conversionRelationId,
      `S9-E2E-REORDER-${runSuffix}`,
      new Date().toISOString(),
    );

    const manager = await userClient("admin@dermavita.local");
    const { data: healthRows, error } = await manager.rpc("get_commercial_health", {
      target_brand_pharmacy_id: conversionRelationId,
    });
    expect(error).toBeNull();
    expect(healthRows).toHaveLength(1);
    expect(healthRows?.[0]).toMatchObject({ orders_count: 2, reorder_count: 1 });
    expect(healthRows?.[0].first_reorder_at).toBeTruthy();
    expect(healthRows?.[0].days_to_first_reorder).toBeGreaterThanOrEqual(69);

    await signIn(page, "admin@dermavita.local", /Dermavita/);
    await page.goto("/dashboard/commercial-health");
    const conversionSection = page.locator("section").filter({ hasText: "Implantations à convertir" });
    await expect(conversionSection).not.toContainText(conversionPharmacyName);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: "artifacts/sprint9/priorities-mobile.png", fullPage: true });
  });

  test("agent — cinq opportunités maximum et création explicite", async ({ page }) => {
    const agent = await userClient("agent@dermavita.local");
    const { data: opportunities, error } = await agent.rpc("get_agent_reorder_opportunities", {
      target_brand_id: dermavitaBrandId,
      result_limit: 50,
    });
    expect(error).toBeNull();
    expect(opportunities?.length).toBeLessThanOrEqual(5);
    expect(opportunities?.some((row) => row.brand_pharmacy_id === agentRelationId)).toBe(true);
    expect(opportunities?.some((row) => row.brand_pharmacy_id === conversionRelationId)).toBe(false);

    await signIn(page, "agent@dermavita.local", /Dermavita/);
    await page.goto("/dashboard/agent");
    const section = page.locator("section").filter({ hasText: "Opportunités de réassort" });
    const opportunityCard = section.locator('[data-slot="card"]').filter({ hasText: agentPharmacyName });
    await expect(opportunityCard).toBeVisible();
    await expect(section.getByText(conversionPharmacyName)).toHaveCount(0);
    await opportunityCard.getByText("Créer la relance").click();
    await opportunityCard.getByRole("button", { name: "Confirmer la création" }).click();

    const admin = adminClient();
    await expect.poll(async () => {
      const { count } = await admin
        .from("tasks")
        .select("*", { count: "exact", head: true })
        .eq("brand_pharmacy_id", agentRelationId)
        .eq("title", `Relance réassort — ${agentPharmacyName}`);
      return count;
    }).toBe(1);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: "artifacts/sprint9/agent-opportunities-mobile.png", fullPage: true });
    const { count } = await admin
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .eq("brand_pharmacy_id", agentRelationId)
      .eq("title", `Relance réassort — ${agentPharmacyName}`);
    expect(count).toBe(1);
  });

  test("sécurité — URL, marque, compte et réglages restent cloisonnés", async () => {
    const agent = await userClient("agent@dermavita.local");
    const { data: unassigned } = await agent.rpc("get_commercial_health", {
      target_brand_pharmacy_id: conversionRelationId,
    });
    expect(unassigned).toEqual([]);

    const { data: foreignBrand } = await agent.rpc("get_commercial_priorities", {
      target_brand_id: nutrilabBrandId,
      target_filter: null,
      result_limit: 100,
    });
    expect(foreignBrand).toEqual([]);

    const { error: forgedOrderError } = await agent.rpc("create_order", {
      target_brand_pharmacy_id: conversionRelationId,
      order_payload: { external_order_id: `S9-E2E-FORGED-${runSuffix}`, order_status: "delivered" },
      item_payload: [{ product_id: productId, quantity: 1, unit_price_ht: 25 }],
    });
    expect(forgedOrderError?.message).toContain("Brand pharmacy unavailable");

    const { error: settingsError } = await agent.rpc("update_commercial_health_settings", {
      target_brand_id: dermavitaBrandId,
      target_default_interval_days: 1,
      target_first_reorder_days: 2,
      target_due_soon_days: 1,
      target_at_risk_multiplier: 1.5,
      target_dormant_multiplier: 2,
      target_eligibility_days: 1,
    });
    expect(settingsError?.message).toContain("Commercial settings forbidden");

    const otherBrandManager = await userClient("admin@nutrilab.local");
    const { data: crossTenantHealth } = await otherBrandManager.rpc("get_commercial_health", {
      target_brand_pharmacy_id: agentRelationId,
    });
    expect(crossTenantHealth).toEqual([]);
  });
});
