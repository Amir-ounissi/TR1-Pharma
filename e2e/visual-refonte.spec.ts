import { expect, test } from "@playwright/test";
import { adminClient, password, signIn } from "./test-helpers";

const brandId = "00000000-0000-0000-0000-000000000101";
const organizationId = "00000000-0000-0000-0000-000000000002";
const directionEmail = `visual.direction.${Date.now()}@dermavita.local`;
let directionUserId: string | null = null;

test.beforeAll(async () => {
  const admin = adminClient();
  const { data: role, error: roleError } = await admin.from("roles").select("id").eq("key", "brand_direction").single();
  expect(roleError).toBeNull();
  expect(role).toBeTruthy();

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: directionEmail,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Direction Visual QA" },
  });
  expect(createError).toBeNull();
  directionUserId = created.user?.id ?? null;
  expect(directionUserId).toBeTruthy();

  const { error: profileError } = await admin
    .from("user_profiles")
    .update({ full_name: "Direction Visual QA", onboarding_completed_at: new Date().toISOString() })
    .eq("user_id", directionUserId);
  expect(profileError).toBeNull();

  const { error: membershipError } = await admin.from("memberships").insert({
    user_id: directionUserId,
    organization_id: organizationId,
    brand_id: brandId,
    role_id: role!.id,
    status: "active",
  });
  expect(membershipError).toBeNull();
});

test.afterAll(async () => {
  if (directionUserId) await adminClient().auth.admin.deleteUser(directionUserId);
});

test("Agent desktop", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await signIn(page, "agent@dermavita.local", /Dermavita/i);
  await page.goto("/dashboard/agent");
  await expect(page.getByRole("heading", { name: "Ma journée", exact: true })).toBeVisible();
  await page.screenshot({ path: "artifacts/visual-refonte/agent-desktop.png", fullPage: true });
});

test("Agent mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, "agent@dermavita.local", /Dermavita/i);
  await page.goto("/dashboard/agent");
  await expect(page.getByRole("navigation", { name: "Navigation mobile" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ma journée", exact: true })).toBeVisible();
  await page.screenshot({ path: "artifacts/visual-refonte/agent-mobile.png", fullPage: true });
});

test("Intervenant mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, "animatrice@dermavita.local", /Dermavita/i);
  await page.goto("/dashboard/field");
  await expect(page.getByRole("heading", { name: "Aujourd’hui", exact: true })).toBeVisible();
  await page.screenshot({ path: "artifacts/visual-refonte/intervenant-mobile.png", fullPage: true });
});

test("Marque desktop", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await signIn(page, "admin@dermavita.local", /Dermavita/i);
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Où en est la marque, et où agir maintenant ?" })).toBeVisible();
  await page.screenshot({ path: "artifacts/visual-refonte/marque-desktop.png", fullPage: true });
});

test("Direction desktop", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await signIn(page, directionEmail, /Dermavita/i);
  await page.goto("/dashboard/direction");
  await expect(page.getByRole("heading", { name: "Trajectoire de la marque" })).toBeVisible();
  await page.screenshot({ path: "artifacts/visual-refonte/direction-desktop.png", fullPage: true });
});

test("Admin TR1 desktop", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/login");
  await page.getByLabel("Email professionnel").fill("superadmin@tr1.local");
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Administration TR1" })).toBeVisible();
  await page.screenshot({ path: "artifacts/visual-refonte/admin-desktop.png", fullPage: true });
});
