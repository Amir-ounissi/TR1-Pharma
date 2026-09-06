import { expect, test } from "@playwright/test";
import { signIn } from "./test-helpers";

test("un administrateur reçoit des Next Best Actions explicables sans écriture automatique", async ({ page }) => {
  await signIn(page, "admin@dermavita.local", /Dermavita/i);
  await page.goto("/dashboard/commercial-health");

  await expect(page.getByRole("heading", { name: "Priorités commerciales" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Next Best Action" })).toBeVisible();
  await expect(page.getByText("Aucune action n’est créée automatiquement.", { exact: true })).toBeVisible();

  const cards = page.getByTestId("next-best-action-card");
  await expect(cards.first()).toBeVisible();
  await expect(cards.first().getByText(/Confiance (élevée|moyenne|prudente)/)).toBeVisible();
  await expect(cards.first().getByText("Pourquoi TR1 la recommande", { exact: true })).toBeVisible();
  await expect(cards.first().getByText(/Score \d+\/100/)).toBeVisible();

  const confirmation = page.locator("summary").filter({ hasText: "Préparer l’action" }).first();
  await expect(confirmation).toBeVisible();
  await confirmation.click();
  await expect(page.getByRole("button", { name: "Confirmer la création" }).first()).toBeVisible();
});

test("un agent ne reçoit pas la couche de décision marque", async ({ page }) => {
  await signIn(page, "agent@dermavita.local", /Dermavita/i);
  await page.goto("/dashboard/commercial-health");
  await expect(page.getByRole("region", { name: "Next Best Action" })).toHaveCount(0);
});
