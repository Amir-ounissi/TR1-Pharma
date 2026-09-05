import { mkdirSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { signIn } from "./test-helpers";

const brandPharmacyId = "00000000-0000-0000-0000-000000000411";
const artifacts = "artifacts/pharmacy-account-cockpit";

test.beforeAll(() => mkdirSync(artifacts, { recursive: true }));

test("Manager voit le cockpit commercial, les activations et la performance", async ({ page }) => {
  await signIn(page, "admin@dermavita.local", /Dermavita/i);
  await page.goto(`/dashboard/pharmacies/${brandPharmacyId}`);

  await expect(page.getByTestId("pharmacy-cockpit")).toBeVisible();
  await expect(page.getByTestId("pharmacy-commercial-objective")).toContainText(/À ouvrir|À suivre|À développer/);
  await expect(page.getByTestId("pharmacy-next-action")).toBeVisible();
  await expect(page.getByTestId("pharmacy-activations")).toContainText("Animations");
  await expect(page.getByTestId("pharmacy-activations")).toContainText("Formations");
  await expect(page.getByTestId("pharmacy-observed-results")).toContainText("ne démontrent pas à elles seules un lien de causalité");
  await expect(page.getByText("Relation commerciale", { exact: true })).toBeVisible();
  await page.screenshot({ path: `${artifacts}/manager-pharmacy-cockpit.png`, fullPage: true });

  await page.goto(`/dashboard/pharmacies/${brandPharmacyId}?tab=performance`);
  await expect(page.getByText("Historique missions & impact observé")).toBeVisible();
  await page.screenshot({ path: `${artifacts}/manager-account-performance.png`, fullPage: true });

  await page.goto("/dashboard/network");
  await expect(page.getByRole("heading", { name: "Où en sommes-nous et où agir maintenant ?" })).toBeVisible();
  await expect(page.getByText("Implantations", { exact: true }).first()).toBeVisible();
  await page.screenshot({ path: `${artifacts}/manager-network-performance.png`, fullPage: true });
});

test("Agent voit le contexte utile sans les données de pilotage confidentielles", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, "agent@dermavita.local", /Dermavita/i);
  await page.goto(`/dashboard/pharmacies/${brandPharmacyId}`);

  await expect(page.getByTestId("pharmacy-cockpit")).toBeVisible();
  await expect(page.getByTestId("pharmacy-commercial-situation")).toBeVisible();
  await expect(page.getByTestId("pharmacy-activations")).toBeVisible();
  await expect(page.getByText("Relation commerciale", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Coût déclaré", { exact: true })).toHaveCount(0);
  await expect(page.getByText("CA observé J+30", { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: `${artifacts}/agent-pharmacy-cockpit-mobile.png`, fullPage: true });
});

test("Intervenant reste limité à ses missions et ne reçoit pas le CRM complet", async ({ page }) => {
  await signIn(page, "animatrice@dermavita.local", /Dermavita/i);
  await page.goto("/dashboard/field");

  await expect(page.getByRole("heading", { name: "Aujourd’hui" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Pharmacies" })).toHaveCount(0);
  await page.goto(`/dashboard/pharmacies/${brandPharmacyId}`);
  await expect(page.getByTestId("pharmacy-cockpit")).toHaveCount(0);
});
