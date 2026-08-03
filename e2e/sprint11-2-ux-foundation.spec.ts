import { mkdirSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { signIn } from "./test-helpers";

const artifacts = "artifacts/sprint11-2";

test.beforeAll(() => mkdirSync(artifacts, { recursive: true }));

test("scénario 1 — Agent desktop", async ({ page }) => {
  await signIn(page, "agent@dermavita.local", /Dermavita/i);
  await page.goto("/dashboard/agent");
  const sidebar = page.getByRole("navigation", { name: "Navigation principale" }).first();
  await expect(sidebar.getByText("Ma journée", { exact: true })).toBeVisible();
  await expect(sidebar.getByText("Priorités", { exact: true })).toHaveCount(0);
  await expect(page.getByTestId("next-visit-card")).toContainText("Pharmacie République");
  await expect(page.getByRole("link", { name: "Démarrer ma prochaine visite" })).toBeVisible();
  await page.screenshot({ path: `${artifacts}/agent-day-desktop.png`, fullPage: true });

  await page.getByRole("button", { name: "Démarrer", exact: true }).click();
  await expect(page.getByTestId("active-visit-card")).toBeVisible();
  await page.getByRole("link", { name: "Créer une commande" }).first().click();
  await expect(page.getByRole("heading", { name: "Nouvelle commande" })).toBeVisible();
  await page.goBack();
  await expect(page.getByTestId("active-visit-card")).toBeVisible();
});

test("scénario 2 — Manager desktop", async ({ page }) => {
  await signIn(page, "admin@dermavita.local", /Dermavita/i);
  const sidebar = page.getByRole("navigation", { name: "Navigation principale" }).first();
  await expect(sidebar.getByText("Priorités", { exact: true })).toBeVisible();
  await expect(sidebar.getByText("Ma journée", { exact: true })).toHaveCount(0);
  await page.goto("/dashboard/commercial-health?filter=reorder_overdue");
  await expect(page.getByRole("heading", { name: "Priorités commerciales" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Réassort en retard" })).toHaveAttribute("data-variant", "default");
  await page.screenshot({ path: `${artifacts}/manager-priorities-desktop.png`, fullPage: true });

  const priorityRow = page.getByTestId("commercial-priority-row").first();
  if (await priorityRow.count()) await priorityRow.getByRole("link").first().click();
  else await page.goto("/dashboard/pharmacies/00000000-0000-0000-0000-000000000411");
  await expect(page.getByTestId("terrain-pharmacy-header")).toBeVisible();
  const followUpLink = page.getByRole("link", { name: "Préparer la relance" });
  await expect(followUpLink).toBeVisible();
  await expect(followUpLink).toHaveAttribute("href", "?tab=activity");
  await page.screenshot({ path: `${artifacts}/pharmacy-detail-desktop.png`, fullPage: true });
  await page.goto(new URL((await followUpLink.getAttribute("href"))!, page.url()).toString());
  await expect(page).toHaveURL(/tab=activity/);
});

test("scénario 3 — Commande globale", async ({ page }) => {
  await signIn(page, "agent@dermavita.local", /Dermavita/i);
  await page.keyboard.press("Control+K");
  const palette = page.getByTestId("command-palette");
  await expect(palette).toBeVisible();
  const search = palette.getByLabel("Rechercher une pharmacie, mission ou tâche");
  await search.fill("Pharmacie République");
  await expect(palette.getByText("Pharmacie République", { exact: true })).toBeVisible();
  await page.screenshot({ path: `${artifacts}/command-palette-desktop.png`, fullPage: true });
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/dashboard\/pharmacies\//);

  await page.keyboard.press("Control+K");
  await search.fill("Missions");
  await expect(palette.getByText("Missions", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(palette).toBeHidden();
  await page.keyboard.press("Control+K");
  await search.fill("Créer une commande");
  await palette.getByText("Créer une commande", { exact: true }).click();
  await expect(page.getByRole("heading", { name: "Nouvelle commande" })).toBeVisible();
});

test("scénario 4 — Mobile Agent", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, "agent@dermavita.local", /Dermavita/i);
  await page.goto("/dashboard/agent");
  const mobileNav = page.getByRole("navigation", { name: "Navigation mobile" });
  await expect(mobileNav).toBeVisible();
  await expect(mobileNav.getByText("Accueil", { exact: true })).toBeVisible();
  await expect(mobileNav.getByText("Plus", { exact: true })).toBeVisible();
  await expect(page.getByTestId("next-visit-card")).toBeInViewport();
  await expect(page.getByRole("button", { name: "Démarrer", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Waze", exact: true }).first()).toBeVisible();
  await expect(page.getByText("Priorités", { exact: true })).toHaveCount(0);
  await page.screenshot({ path: `${artifacts}/agent-day-mobile.png`, fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});

test("scénario 5 — Permissions et vue personnelle", async ({ browser }) => {
  const agentContext = await browser.newContext();
  const agentPage = await agentContext.newPage();
  await signIn(agentPage, "agent@dermavita.local", /Dermavita/i);
  await agentPage.keyboard.press("Control+K");
  await agentPage.getByLabel("Rechercher une pharmacie, mission ou tâche").fill("Bellecour");
  await expect(agentPage.getByText("Aucun résultat dans votre périmètre.")).toBeVisible();
  await expect(agentPage.getByText("Imports", { exact: true })).toHaveCount(0);
  await agentContext.close();

  const managerContext = await browser.newContext();
  const managerPage = await managerContext.newPage();
  await signIn(managerPage, "admin@dermavita.local", /Dermavita/i);
  await managerPage.keyboard.press("Control+K");
  await managerPage.getByLabel("Rechercher une pharmacie, mission ou tâche").fill("Bellecour");
  await expect(managerPage.getByText("Aucun résultat dans votre périmètre.")).toBeVisible();
  await managerPage.keyboard.press("Escape");
  await managerPage.goto("/dashboard/commercial-health?filter=reorder_overdue");
  await managerPage.getByRole("button", { name: "Enregistrer cette vue" }).click();
  await expect(managerPage.getByTestId("saved-view-controls")).toContainText("Priorités · reorder overdue");
  await managerContext.close();
});

test("scénario 6 — Non-régression et navigation Admin", async ({ page }) => {
  await signIn(page, "admin@dermavita.local", /Dermavita/i);
  await page.goto("/dashboard/tasks");
  await expect(page.getByRole("heading", { name: "Tâches commerciales" })).toBeVisible();
  await page.goto("/dashboard/missions/new");
  await expect(page.getByRole("button", { name: "Créer la mission" })).toBeVisible();
  await page.goto("/dashboard/orders/new");
  await expect(page.getByRole("heading", { name: "Nouvelle commande" })).toBeVisible();
  await page.goto("/dashboard/imports");
  await expect(page.getByRole("heading", { name: "Imports CSV" })).toBeVisible();
  await page.goto("/dashboard/admin/design-system");
  await expect(page.getByTestId("design-system-page")).toBeVisible();
  await page.screenshot({ path: `${artifacts}/navigation-role-comparison.png`, fullPage: true });
});
