import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./test-helpers";

const AGENT_EMAIL = "agent@dermavita.local";
const BRAND = /Dermavita/i;
const PHARMACY_ID = "00000000-0000-0000-0000-000000000411";

const desktopDestinations = [
  ["/dashboard/agent", "Ma journée"],
  ["/dashboard/agenda", "Agenda"],
  ["/dashboard/pharmacies", "Pharmacies"],
  ["/dashboard/orders", "Mes commandes"],
  ["/dashboard/agent/performance", "Ma performance"],
  ["/dashboard/agent/more", "Plus"],
] as const;

const moreDestinations = [
  ["/dashboard/agent/performance", "Ma performance"],
  ["/dashboard/products", "Produits"],
  ["/dashboard/missions", "Missions"],
  ["/dashboard/tasks", "Tâches"],
  ["/dashboard/sell-out", "Sell-out"],
  ["/dashboard/reports", "Mes comptes rendus"],
  ["/dashboard/agent/assistant", "Assistant Terrain"],
  ["/dashboard/agent/settings", "Paramètres"],
] as const;

const mobileDestinations = [
  ["/dashboard/agent", "Terrain"],
  ["/dashboard/agenda", "Agenda"],
  ["/dashboard/pharmacies", "Pharmacies"],
  ["/dashboard/orders", "Commandes"],
  ["/dashboard/agent/more", "Plus"],
] as const;

const pharmacyDesktopTabs = [
  ["overview", "Vue générale"],
  ["activity", "Activité"],
  ["orders", "Commandes"],
  ["performance", "Performance"],
  ["contacts", "Contacts"],
  ["products", "Produits / Assortiment"],
  ["history", "Historique"],
  ["admin", "Administratif"],
] as const;

const mutationPattern =
  /supprimer|retirer|déconnect|envoyer|créer|ajouter|enregistrer|valider|confirmer|clôturer|terminer|démarrer|annuler.*commande|importer|téléverser|upload/i;

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^$()|[\]\\]/g, "\\$&");
}

function attachRuntimeGuards(page: Page) {
  const failures: string[] = [];

  page.on("pageerror", (error) => failures.push(`pageerror: ${error.message}`));
  page.on("response", (response) => {
    const url = new URL(response.url());
    const current = new URL(page.url() || "http://127.0.0.1");
    if (url.origin === current.origin && response.status() >= 500) {
      failures.push(`${response.status()} ${url.pathname}`);
    }
  });

  return () => {
    expect(failures, failures.join("\\n")).toEqual([]);
  };
}

async function assertHealthy(page: Page) {
  await expect(page.locator("[data-nextjs-dialog]")).toHaveCount(0);
  const bodyText = (await page.locator("body").innerText()).trim();
  expect(bodyText.length).toBeGreaterThan(20);
}

async function assertNoHorizontalOverflow(page: Page, label: string) {
  const result = await page.evaluate(() => {
    const viewport = document.documentElement.clientWidth;
    const delta = document.documentElement.scrollWidth - viewport;
    const offenders = Array.from(document.querySelectorAll<HTMLElement>("body *"))
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName,
          text: (element.innerText || element.getAttribute("aria-label") || "").trim().slice(0, 80),
          className: typeof element.className === "string" ? element.className.slice(0, 220) : "",
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
        };
      })
      .filter((item) => item.right > viewport + 1 || item.left < -1 || item.width > viewport + 1)
      .slice(0, 12);
    return { delta, viewport, offenders };
  });
  console.log(`AUDIT_MOBILE_OVERFLOW ${label} ${JSON.stringify(result)}`);
  expect(result.delta, `${label}: ${JSON.stringify(result.offenders)}`).toBeLessThanOrEqual(1);
}

async function clickInternalLink(page: Page, href: string, label?: string) {
  const link = page.locator(`a[href="${href}"]`).filter({ visible: true }).first();
  await expect(link, label ?? href).toBeVisible();
  const startedAt = Date.now();
  await link.click();
  await expect(page).toHaveURL(new RegExp(escapeRegExp(href)));
  console.log(`AUDIT_NAV ${href} ${Date.now() - startedAt}ms`);
  await assertHealthy(page);
}

async function exerciseSafeButtons(page: Page, route: string) {
  const buttons = page.locator('button:visible, [role="tab"]:visible');
  const count = await buttons.count();
  let tested = 0;
  let skippedMutation = 0;

  for (let i = 0; i < count; i += 1) {
    const button = buttons.nth(i);
    if (!(await button.isVisible().catch(() => false))) continue;
    if (await button.isDisabled().catch(() => true)) continue;

    const text = ((await button.getAttribute("aria-label")) || (await button.innerText().catch(() => ""))).trim();
    if (!text) continue;
    if (mutationPattern.test(text)) {
      skippedMutation += 1;
      continue;
    }

    const currentUrl = page.url();
    console.log(`AUDIT_BUTTON ${route} "${text}"`);
    await button.click({ timeout: 10_000 }).catch((error) => {
      throw new Error(`Button failed on ${route}: "${text}" — ${String(error)}`);
    });
    tested += 1;
    await page.waitForTimeout(60);
    await expect(page.locator("[data-nextjs-dialog]"), `Next.js overlay after "${text}" on ${route}`).toHaveCount(0);

    if (page.url() !== currentUrl) {
      await page.goto(route);
      await assertHealthy(page);
    } else {
      await page.keyboard.press("Escape").catch(() => {});
    }
  }

  console.log(`AUDIT_CONTROLS ${route} tested=${tested} skipped_mutation=${skippedMutation}`);
}

test("audit agent desktop — navigation, écrans et contrôles non destructifs", async ({ page }) => {
  test.setTimeout(600_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  const assertNoRuntimeFailures = attachRuntimeGuards(page);
  await signIn(page, AGENT_EMAIL, BRAND);

  for (const [href, label] of desktopDestinations) {
    await page.goto("/dashboard/agent");
    const nav = page.getByRole("navigation", { name: "Navigation principale" });
    const link = nav.locator(`a[href="${href}"]`);
    await expect(link, label).toBeVisible();
    const startedAt = Date.now();
    await link.click();
    await expect(page).toHaveURL(new RegExp(escapeRegExp(href)));
    console.log(`AUDIT_DESKTOP_NAV ${label} ${Date.now() - startedAt}ms`);
    await assertHealthy(page);
  }

  for (const [href, label] of moreDestinations) {
    await page.goto("/dashboard/agent/more");
    await clickInternalLink(page, href, label);
  }

  const uniqueRoutes = [...new Set([...desktopDestinations, ...moreDestinations].map(([route]) => route))];
  for (const route of uniqueRoutes) {
    await page.goto(route);
    await assertHealthy(page);
    await exerciseSafeButtons(page, route);
  }

  assertNoRuntimeFailures();
});

test("audit fiche pharmacie desktop — tous les onglets terrain", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const assertNoRuntimeFailures = attachRuntimeGuards(page);
  await signIn(page, AGENT_EMAIL, BRAND);

  for (const [tab, label] of pharmacyDesktopTabs) {
    await page.goto(`/dashboard/pharmacies/${PHARMACY_ID}`);
    const nav = page.getByRole("navigation", { name: "Sections de la pharmacie" });
    const link = nav.getByRole("link", { name: label, exact: true });
    await expect(link).toBeVisible();
    const startedAt = Date.now();
    await link.click();
    await expect.poll(() => new URL(page.url()).searchParams.get("tab")).toBe(tab);
    console.log(`AUDIT_PHARMACY_DESKTOP ${label} ${Date.now() - startedAt}ms`);
    await assertHealthy(page);
  }

  await page.goto(`/dashboard/pharmacies/${PHARMACY_ID}`);
  await clickInternalLink(page, `/dashboard/pharmacies/${PHARMACY_ID}/commercial-terms`, "Conditions commerciales");

  await page.goto(`/dashboard/pharmacies/${PHARMACY_ID}`);
  await clickInternalLink(page, `/dashboard/pharmacies/${PHARMACY_ID}/brief`, "Préparer ma visite");

  for (const route of [
    `/dashboard/pharmacies/${PHARMACY_ID}/notes`,
    `/dashboard/pharmacies/${PHARMACY_ID}/prices`,
  ]) {
    await page.goto(route);
    await assertHealthy(page);
    await exerciseSafeButtons(page, route);
  }

  assertNoRuntimeFailures();
});

test("audit agent PWA — navigation basse, Plus et onglets pharmacie", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const assertNoRuntimeFailures = attachRuntimeGuards(page);
  await signIn(page, AGENT_EMAIL, BRAND);

  for (const [href, label] of mobileDestinations) {
    await page.goto("/dashboard/agent");
    const nav = page.getByRole("navigation", { name: "Navigation mobile" });
    const link = nav.locator(`a[href="${href}"]`);
    await expect(link, label).toBeVisible();
    const startedAt = Date.now();
    await link.click();
    await expect(page).toHaveURL(new RegExp(escapeRegExp(href)));
    console.log(`AUDIT_MOBILE_NAV ${label} ${Date.now() - startedAt}ms`);
    await assertHealthy(page);
    await assertNoHorizontalOverflow(page, label);
  }

  for (const [href, label] of moreDestinations) {
    await page.goto("/dashboard/agent/more");
    const link = page.locator(`a[href="${href}"]`).filter({ visible: true }).first();
    if (await link.count()) {
      await expect(link, label).toBeVisible();
      await link.click();
      await assertHealthy(page);
    }
  }

  const primaryTabs = [
    ["overview", "Vue générale"],
    ["activity", "Activité"],
    ["orders", "Commandes"],
  ] as const;

  for (const [tab, label] of primaryTabs) {
    await page.goto(`/dashboard/pharmacies/${PHARMACY_ID}`);
    const nav = page.getByRole("navigation", { name: "Sections principales de la pharmacie" });
    await nav.getByRole("link", { name: label, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`tab=${tab}`));
    await assertHealthy(page);
  }

  const moreTabs = [
    ["performance", "Performance"],
    ["contacts", "Contacts"],
    ["products", "Produits / Assortiment"],
    ["history", "Historique"],
    ["admin", "Administratif"],
  ] as const;

  for (const [tab, label] of moreTabs) {
    await page.goto(`/dashboard/pharmacies/${PHARMACY_ID}`);
    const nav = page.getByRole("navigation", { name: "Sections principales de la pharmacie" });
    await nav.getByRole("button", { name: /Plus/i }).click();
    await page.getByRole("link", { name: label, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`tab=${tab}`));
    await assertHealthy(page);
  }

  await page.goto(`/dashboard/pharmacies/${PHARMACY_ID}`);
  const nav = page.getByRole("navigation", { name: "Sections principales de la pharmacie" });
  await nav.getByRole("button", { name: /Plus/i }).click();
  await page.getByRole("link", { name: "Conditions commerciales", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/dashboard/pharmacies/${PHARMACY_ID}/commercial-terms`));
  await assertHealthy(page);

  assertNoRuntimeFailures();
});
