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


test("la recherche pharmacies desktop filtre sans cliquer sur Appliquer", async ({ page }) => {
  await signIn(page, "admin@dermavita.local", /Dermavita/i);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/dashboard/pharmacies?view=list");

  const search = page.getByRole("textbox", { name: "Rechercher une pharmacie" });
  await search.fill("République");
  await expect(page).toHaveURL(/q=R%C3%A9publique/);
  await expect(page.locator("table:visible").getByText("Pharmacie République", { exact: true })).toBeVisible();

  await search.fill("zzaucuneofficine99");
  await expect(page).toHaveURL(/q=zzaucuneofficine99/);
  await expect(page.getByText("Pharmacie République", { exact: true })).toHaveCount(0);
});

test("la recherche pharmacies mobile garde le focus après le filtre serveur", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, "agent@dermavita.local", /Dermavita/i);
  await page.goto("/dashboard/pharmacies?view=list");

  const search = page.getByRole("textbox", { name: "Rechercher une pharmacie" });
  await search.fill("République");
  await expect(page).toHaveURL(/q=R%C3%A9publique/);
  await expect(search).toBeFocused();
  await search.fill("République Est");
  await expect(page).toHaveURL(/q=R%C3%A9publique\+Est/);
  await expect(search).toBeFocused();
});
