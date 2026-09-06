import { expect, test } from "@playwright/test";
import { signIn } from "./test-helpers";

test("les filtres avancés pharmacies sont soumis et conservent les filtres rapides", async ({ page }) => {
  await signIn(page, "admin@dermavita.local", /Dermavita/i);
  await page.goto("/dashboard/pharmacies?status=active");

  await page.getByRole("button", { name: "Filtres +" }).click();
  const filters = page.getByRole("dialog");
  await filters.getByPlaceholder("Ville").fill("Paris");
  await filters.getByRole("button", { name: "Appliquer" }).click();

  await expect(page).toHaveURL(/status=active/);
  await expect(page).toHaveURL(/city=Paris/);
});
