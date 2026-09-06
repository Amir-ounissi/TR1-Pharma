import { expect, test } from "@playwright/test";
import { adminClient, password, signIn } from "./test-helpers";

const brandId = "00000000-0000-0000-0000-000000000101";
const organizationId = "00000000-0000-0000-0000-000000000002";
const email = `direction.e2e.${Date.now()}@dermavita.local`;
let directionUserId: string | null = null;

test.beforeAll(async () => {
  const admin = adminClient();
  const { data: role, error: roleError } = await admin.from("roles").select("id").eq("key", "brand_direction").single();
  expect(roleError).toBeNull();
  expect(role).toBeTruthy();

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Direction E2E" },
  });
  expect(createError).toBeNull();
  expect(created.user).toBeTruthy();
  directionUserId = created.user?.id ?? null;
  expect(directionUserId).toBeTruthy();

  const { data: profile, error: profileError } = await admin
    .from("user_profiles")
    .update({ full_name: "Direction E2E", onboarding_completed_at: new Date().toISOString() })
    .eq("user_id", directionUserId)
    .select("user_id")
    .single();
  expect(profileError).toBeNull();
  expect(profile).toBeTruthy();

  const { error: membershipError } = await admin.from("memberships").insert({
    user_id: directionUserId,
    organization_id: organizationId,
    brand_id: brandId,
    role_id: role.id,
    status: "active",
  });
  expect(membershipError).toBeNull();
});

test.afterAll(async () => {
  if (!directionUserId) return;
  await adminClient().auth.admin.deleteUser(directionUserId);
});

test("la Direction dispose d’un workspace exécutif dédié et en lecture seule", async ({ page }) => {
  await signIn(page, email, /Dermavita/i);
  await expect(page).toHaveURL(/\/dashboard\/direction$/);
  await expect(page.getByRole("heading", { name: "Piloter la trajectoire, sans bruit opérationnel" })).toBeVisible();
  await expect(page.getByText("CA réalisé YTD", { exact: true })).toBeVisible();
  await expect(page.getByText("Évolution vs N-1", { exact: true })).toBeVisible();
  await expect(page.getByText("Atterrissage déterministe", { exact: true })).toBeVisible();
  await expect(page.getByText("Comparaison des territoires", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Vue Direction", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /Commandes/i })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Pharmacies/i })).toHaveCount(0);
});

test("un agent ne peut pas ouvrir le workspace Direction", async ({ page }) => {
  await signIn(page, "agent@dermavita.local", /Dermavita/i);
  await page.goto("/dashboard/direction");
  await expect(page).not.toHaveURL(/\/dashboard\/direction$/);
});
