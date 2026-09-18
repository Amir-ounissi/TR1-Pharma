import { expect, test } from "@playwright/test";
import { signIn } from "./test-helpers";

function todayVisitLink(page: import("@playwright/test").Page) {
  return page.locator('a[href^="/dashboard/visits/"]').filter({ hasText: "Pharmacie République" }).first();
}

test("Sprint 6.1 desktop — journée simplifiée et clôture directe", async ({ page }) => {
  await signIn(page, "agent@dermavita.local", /Dermavita/i);
  await page.goto("/dashboard/agent");

  await expect(page.getByRole("heading", { name: "Aujourd’hui", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Mon programme", exact: true })).toBeVisible();
  await expect(page.getByTestId("next-visit-card")).toHaveCount(0);
  await expect(page.getByTestId("active-visit-card")).toHaveCount(0);

  const link = todayVisitLink(page);
  await expect(link).toContainText("Pharmacie République");
  await expect(link).toContainText("Clôturer");
  await link.click();

  await expect(page.getByRole("heading", { name: "Clôturer la visite", exact: true })).toBeVisible();
  await expect(page.getByLabel("Résultat")).toBeVisible();
  await expect(page.getByLabel("Notes / compte rendu")).toBeVisible();
  await expect(page.locator('input[name="photos"]')).toHaveCount(1);
  await expect(page.getByText("Planifier la prochaine visite", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Démarrer la visite", exact: true })).toHaveCount(0);
});

test("Sprint 6.1 mobile — CTA clôturer accessible sans étape intermédiaire", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, "agent@dermavita.local", /Dermavita/i);
  await page.goto("/dashboard/agent");

  const link = todayVisitLink(page);
  await expect(link).toBeVisible();
  await link.click();

  await expect(page.getByRole("heading", { name: "Clôturer la visite", exact: true })).toBeVisible();
  const submit = page.getByRole("button", { name: "Clôturer la visite", exact: true });
  await expect(submit).toBeVisible();

  const [navBox, submitBox] = await Promise.all([
    page.getByRole("navigation", { name: "Navigation mobile" }).boundingBox(),
    submit.boundingBox(),
  ]);
  expect(submitBox).not.toBeNull();
  expect(navBox).not.toBeNull();
  expect(submitBox!.y + submitBox!.height).toBeLessThanOrEqual(navBox!.y + 1);

  await page.screenshot({ path: "artifacts/sprint6-1/agent-ux-mobile-390.png", fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});
