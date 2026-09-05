import { expect, test } from "@playwright/test";

test("le signup public permet un intervenant Animation + Formation avec un seul compte", async ({ page }) => {
  await page.goto("/signup");

  const facilitatorProfile = page.getByRole("button", { name: /Intervenant/i });
  await expect(facilitatorProfile).toBeVisible();
  await facilitatorProfile.click();

  await expect(page.getByText("Votre activité", { exact: true })).toBeVisible();

  const animation = page.getByLabel("Animation", { exact: true });
  const training = page.getByLabel("Formation", { exact: true });
  const submit = page.getByRole("button", { name: "Créer mon compte" });

  await expect(animation).not.toBeChecked();
  await expect(training).not.toBeChecked();
  await expect(submit).toBeDisabled();

  await animation.check();
  await expect(submit).toBeEnabled();

  await training.check();
  await expect(animation).toBeChecked();
  await expect(training).toBeChecked();
  await expect(submit).toBeEnabled();
});
