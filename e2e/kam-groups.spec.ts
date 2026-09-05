import { expect, test } from "@playwright/test";
import { signIn } from "./test-helpers";

test("un administrateur pilote les groupements et ouvre le parc officinal", async ({ page }) => {
  await signIn(page, "admin@dermavita.local", /Dermavita/i);
  await page.goto("/dashboard/kam-groups");

  await expect(page.getByRole("heading", { name: "Mesurer la pénétration réseau et le potentiel restant" })).toBeVisible();
  await expect(page.getByText("Parc groupements", { exact: true })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Pénétration" })).toBeVisible();

  const groupLink = page.getByRole("link", { name: "Santé Plus", exact: true });
  await expect(groupLink).toBeVisible();
  await groupLink.click();

  await expect(page.getByRole("heading", { name: "Santé Plus", exact: true })).toBeVisible();
  await expect(page.getByText("Parc officinal", { exact: true })).toBeVisible();
  await expect(page.getByText("Pharmacie République", { exact: true })).toBeVisible();
});

test("un agent ne voit pas KAM Groupements dans sa navigation", async ({ page }) => {
  await signIn(page, "agent@dermavita.local", /Dermavita/i);
  await expect(page.getByRole("link", { name: "KAM Groupements" })).toHaveCount(0);
});
