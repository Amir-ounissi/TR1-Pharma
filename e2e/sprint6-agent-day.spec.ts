import { expect, test, type Browser, type Page } from "@playwright/test";
import { adminClient, signIn } from "./test-helpers";

async function openNavigation(page: Page, label: "Waze" | "Maps") {
  const link = page.getByRole("link", { name: label, exact: true }).first();
  await expect(link).toHaveAttribute("target", "_blank");
  const popupPromise = page.context().waitForEvent("page");
  await link.click();
  const popup = await popupPromise;
  await popup.close();
}

async function runAgentDay(browser: Browser, viewport: { width: number; height: number }, suffix: string) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const note = `Compte rendu terrain Sprint 6 ${suffix} ${Date.now()}`;
  const eventWindowStartedAt = new Date().toISOString();

  await signIn(page, "agent@dermavita.local", /Dermavita/i);
  await page.goto("/dashboard/agent");
  await expect(page.getByRole("heading", { name: /Bonjour Nora/i })).toBeVisible();
  await expect(page.getByTestId("next-visit-card")).toContainText("Pharmacie République");
  await expect(page.getByRole("link", { name: "Appeler", exact: true }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Waze", exact: true }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Maps", exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Démarrer", exact: true })).toBeVisible();

  await openNavigation(page, "Maps");
  await page.getByRole("link", { name: "Fiche", exact: true }).click();
  await expect(page.getByTestId("terrain-pharmacy-header")).toContainText("Pharmacie République");
  await expect(page.getByTestId("terrain-pharmacy-header")).toContainText("Dernière commande");
  await expect(page.getByTestId("terrain-pharmacy-header").getByRole("link", { name: "Waze", exact: true })).toBeVisible();

  await page.goto("/dashboard/agent");
  await page.getByRole("button", { name: "Démarrer", exact: true }).click();
  await expect(page.getByTestId("active-visit-card")).toContainText("Visite en cours");
  await page.getByRole("button", { name: "Terminer la visite", exact: true }).click();
  await expect(page.locator("#quick-interaction")).toBeInViewport();
  await page.getByLabel("Type").selectOption("visit");
  await page.getByLabel("Résultat").selectOption("interested");
  await page.getByLabel("Note courte").fill(note);
  await page.getByLabel("Prochaine action", { exact: true }).selectOption("call");
  const dueAt = new Date(Date.now() - 60_000).toISOString().slice(0, 16);
  await page.getByLabel("Quand").fill(dueAt);
  await page.getByRole("button", { name: "Enregistrer et revenir à ma journée" }).click();
  await expect(page.getByRole("status")).toContainText("Interaction et prochaine action enregistrées", { timeout: 60_000 });
  await expect(page.getByText("En retard").first()).toBeVisible();

  const admin = adminClient();
  const interactionResult = await admin.from("interactions").select("id,brand_id,brand_pharmacy_id,created_by,notes,related_task_id").eq("notes", note).single();
  expect(interactionResult.error).toBeNull();
  expect(interactionResult.data).toMatchObject({
    brand_id: "00000000-0000-0000-0000-000000000101",
    brand_pharmacy_id: "00000000-0000-0000-0000-000000000411",
    created_by: "00000000-0000-0000-0000-0000000000a3",
  });
  expect(interactionResult.data?.related_task_id).toBeTruthy();
  const taskResult = await admin.from("tasks").select("assigned_to,task_type,status").eq("id", interactionResult.data!.related_task_id).single();
  expect(taskResult.data).toMatchObject({ assigned_to: "00000000-0000-0000-0000-0000000000a3", task_type: "call", status: "open" });
  const eventsResult = await admin
    .from("product_events")
    .select("event_name,user_id,brand_id,pharmacy_id,occurred_at")
    .eq("user_id", "00000000-0000-0000-0000-0000000000a3")
    .gte("occurred_at", eventWindowStartedAt);
  expect(eventsResult.error).toBeNull();
  expect(eventsResult.data?.map((event) => event.event_name)).toEqual(expect.arrayContaining(["agent_dashboard_viewed", "pharmacy_opened", "navigation_maps_clicked", "interaction_started", "interaction_submitted", "next_action_created"]));
  expect(eventsResult.data?.every((event) => event.brand_id === "00000000-0000-0000-0000-000000000101")).toBe(true);

  return { context, page };
}

test("Sprint 6 Agent Day desktop", async ({ browser }) => {
  const { context, page } = await runAgentDay(browser, { width: 1440, height: 1000 }, "desktop");
  await page.screenshot({ path: "artifacts/sprint6/agent-day-desktop.png", fullPage: true });
  await context.close();
});

test("Sprint 6 Agent Day mobile et largeurs terrain", async ({ browser }) => {
  const { context, page } = await runAgentDay(browser, { width: 390, height: 844 }, "mobile");
  await page.screenshot({ path: "artifacts/sprint6/agent-day-mobile-390.png", fullPage: true });
  for (const width of [375, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/dashboard/agent");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `no horizontal overflow at ${width}px`).toBeLessThanOrEqual(1);
    await expect(page.getByRole("button", { name: "Démarrer", exact: true })).toBeVisible();
  }
  await context.close();
});
