import { expect, test, type Page } from "@playwright/test";
import { adminClient, signIn } from "./test-helpers";

async function completeVisit(page: Page, suffix: string) {
  const note = `Polish Agent 6.1 ${suffix} ${Date.now()}`;
  await page.getByRole("button", { name: "Démarrer", exact: true }).click();
  await expect(page.getByTestId("active-visit-card")).toContainText("Visite en cours");
  await page.getByRole("button", { name: "Terminer la visite", exact: true }).click();
  await expect(page.getByTestId("visit-completion-form")).toBeVisible();
  await expect(page.getByLabel("Type")).toHaveValue("visit");
  await page.getByLabel("Résultat").selectOption("interested");
  await page.getByLabel("Note courte").fill(note);
  await page.getByLabel("Prochaine action", { exact: true }).selectOption("call");
  await page.getByLabel("Quand").fill(new Date(Date.now() + 86_400_000).toISOString().slice(0, 16));
  await page.getByRole("button", { name: "Enregistrer et revenir à ma journée" }).click();
  await expect(page.getByRole("status")).toContainText("Visite terminée");
  await expect(page.getByTestId("active-visit-card")).toHaveCount(0);
  return note;
}

test("Sprint 6.1 desktop — mode visite et retour journée", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  await signIn(page, "agent@dermavita.local", /Dermavita/i);
  await page.goto("/dashboard/agent");

  const card = page.getByTestId("next-visit-card");
  await expect(card).toContainText("Stratégique");
  await expect(card).toContainText("Très fort potentiel");
  await expect(card).not.toContainText("very_high");
  await expect(card).not.toContainText("strategic");
  const note = await completeVisit(page, "desktop");

  const interaction = await adminClient().from("interactions").select("duration_minutes,interaction_type,notes").eq("notes", note).single();
  expect(interaction.error).toBeNull();
  expect(interaction.data?.interaction_type).toBe("visit");
  expect(Number(interaction.data?.duration_minutes)).toBeGreaterThanOrEqual(1);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "artifacts/sprint6-1/agent-ux-desktop.png" });
  await context.close();
});

test("Sprint 6.1 mobile — compacité, restauration et CTA non masqué", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await signIn(page, "agent@dermavita.local", /Dermavita/i);
  await page.goto("/dashboard/agent");

  const card = page.getByTestId("next-visit-card");
  await expect(card).toBeVisible();
  const cardBox = await card.boundingBox();
  expect(cardBox!.height).toBeLessThan(720);
  await expect(card.getByText("Voir le contexte")).toBeVisible();
  await page.screenshot({ path: "artifacts/sprint6-1/agent-ux-mobile-compact-390.png" });
  await page.getByRole("button", { name: "Démarrer", exact: true }).click();
  await page.reload();
  await expect(page.getByTestId("active-visit-card")).toContainText("Visite en cours");
  await expect(page.getByTestId("active-visit-card")).toContainText("Pharmacie République");

  for (const label of ["Appel", "Waze", "Maps"]) {
    const action = page.getByTestId("active-visit-card").getByRole("link", { name: label, exact: true });
    const box = await action.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
  }

  await page.getByRole("button", { name: "Terminer la visite", exact: true }).click();
  const submit = page.getByRole("button", { name: "Enregistrer et revenir à ma journée" });
  await submit.scrollIntoViewIfNeeded();
  const [headerBox, submitBox] = await Promise.all([
    page.getByTestId("mobile-sticky-header").boundingBox(),
    submit.boundingBox(),
  ]);
  expect(submitBox!.y).toBeGreaterThanOrEqual(headerBox!.y + headerBox!.height);
  expect(submitBox!.y + submitBox!.height).toBeLessThanOrEqual(844);

  await page.getByLabel("Résultat").selectOption("interested");
  await page.getByLabel("Note courte").fill(`Polish Agent 6.1 mobile ${Date.now()}`);
  await page.getByLabel("Prochaine action", { exact: true }).selectOption("call");
  await page.getByLabel("Quand").fill(new Date(Date.now() + 86_400_000).toISOString().slice(0, 16));
  await page.screenshot({ path: "artifacts/sprint6-1/agent-ux-mobile-390.png" });
  await submit.click();
  await expect(page.getByRole("status")).toContainText("Visite terminée");
  await expect(page.getByTestId("active-visit-card")).toHaveCount(0);
  await context.close();
});
