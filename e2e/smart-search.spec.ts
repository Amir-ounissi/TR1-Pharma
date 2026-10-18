import { expect, test } from "@playwright/test";
import { signIn } from "./test-helpers";

test("recherche intelligente — intention relance et navigation rapide", async ({ page }) => {
  await signIn(page, "agent@dermavita.local", /Dermavita/i);
  await page.keyboard.press("Control+K");
  const palette = page.getByTestId("command-palette");
  const search = palette.getByLabel("Rechercher une pharmacie, mission ou tâche");
  await expect(palette.getByText("Essayez une demande")).toBeVisible();

  await search.fill("pharmacies à relancer");
  const action = palette.getByRole("button", { name: /pharmacies à relancer/i });
  await expect(action).toBeVisible();
  await action.click();
  await expect(page).toHaveURL(/\/dashboard\/pharmacies\?.*attention=1/);
});

test("recherche intelligente — un changement de marque forgé est refusé", async ({ page }) => {
  await signIn(page, "agent@dermavita.local", /Dermavita/i);
  await page.goto("/dashboard/search/open?brand=00000000-0000-0000-0000-999999999999&to=%2Fdashboard%2Forders");
  await expect(page).toHaveURL(/\/dashboard\/account\?error=unauthorized/);
});

test("recherche intelligente — une URL externe est refusée même avec une marque autorisée", async ({ page }) => {
  await signIn(page, "agent@dermavita.local", /Dermavita/i);
  await page.goto("/dashboard/search/open?brand=00000000-0000-0000-0000-000000000001&to=%2F%2Fevil.example%2F");
  await expect(page).toHaveURL(/\/dashboard\/account\?error=unauthorized/);
});
