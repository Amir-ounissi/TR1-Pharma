import { expect, test } from "@playwright/test";
import { signIn } from "./test-helpers";

test("un administrateur de marque lit son abonnement, ses sièges et ses quotas", async ({ page }) => {
  await signIn(page, "admin@dermavita.local", /Dermavita/i);

  await expect(page.getByRole("link", { name: "Abonnement & usage", exact: true })).toBeVisible();
  await page.goto("/dashboard/subscription");

  await expect(page.getByRole("heading", { name: "Abonnement & usage", exact: true })).toBeVisible();
  await expect(page.getByTestId("saas-subscription-overview")).toBeVisible();
  await expect(page.getByText("Legacy Full", { exact: true })).toBeVisible();
  await expect(page.getByTestId("saas-seat-usage")).toContainText("Illimité");
  await expect(page.getByTestId("saas-quota-card")).toHaveCount(4);
  await expect(page.getByText("À configurer", { exact: true })).toBeVisible();
});

test("un agent ne voit ni navigation ni termes commerciaux SaaS", async ({ page }) => {
  await signIn(page, "agent@dermavita.local", /Dermavita/i);

  await expect(page.getByRole("link", { name: "Abonnement & usage", exact: true })).toHaveCount(0);
  await page.goto("/dashboard/subscription");
  await expect(page).not.toHaveURL(/\/dashboard\/subscription$/);
});

test("le superadmin dispose d’une console plateforme distincte des réglages tenant", async ({ page }) => {
  await signIn(page, "superadmin@tr1.local", /Dermavita/i);

  await expect(page.getByRole("link", { name: "Quotas & billing", exact: true })).toHaveCount(0);
  await page.goto("/dashboard/admin/saas-commercial");

  await expect(page.getByRole("heading", { name: "Quotas & billing", exact: true })).toBeVisible();
  await expect(page.getByTestId("saas-commercial-admin")).toBeVisible();
  await expect(page.getByTestId("plan-quota-form")).toHaveCount(16);
  await expect(page.getByTestId("billing-readiness-form")).toBeVisible();
});
