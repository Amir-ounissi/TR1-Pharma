import { expect, test } from "@playwright/test";
import { signIn } from "./test-helpers";

test("le cockpit Direction consolide trajectoire, N-1, DN et alertes", async ({ page }) => {
  await signIn(page, "admin@dermavita.local", /Dermavita/i);
  await page.goto("/dashboard/executive");

  await expect(page.getByRole("heading", { name: "La trajectoire business, les écarts et les priorités en une page" })).toBeVisible();
  await expect(page.getByText("CA facturé YTD", { exact: true })).toBeVisible();
  await expect(page.getByText("Évolution vs N-1", { exact: true })).toBeVisible();
  await expect(page.getByText("Atterrissage CA", { exact: true })).toBeVisible();
  await expect(page.getByText("DN moyenne", { exact: true })).toBeVisible();
  await expect(page.getByText("Alertes Direction", { exact: true })).toBeVisible();
  await expect(page.getByText("Comptes qui demandent une décision", { exact: true })).toBeVisible();
});

test("un agent ne voit pas le cockpit Direction dans sa navigation", async ({ page }) => {
  await signIn(page, "agent@dermavita.local", /Dermavita/i);
  await expect(page.getByRole("link", { name: "Cockpit Direction" })).toHaveCount(0);
});
