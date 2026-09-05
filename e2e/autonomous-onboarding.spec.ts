import { expect, test } from "@playwright/test";
import { adminClient, password } from "./test-helpers";

const suffix = Date.now().toString().slice(-7);
const email = `autonomous-${suffix}@tr1.local`;
const companyName = `Laboratoire Autonome ${suffix}`;
const brandName = `Marque Autonome ${suffix}`;
const brandCode = `AUTO_${suffix}`;

test("un compte marque reprend son onboarding autonome et crée un tenant brouillon", async ({ page }) => {
  test.setTimeout(180_000);
  const admin = adminClient();

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: "Direction Autonome",
      requested_profile_type: "brand",
      requested_access: {
        type: "brand",
        company_name: companyName,
        job_title: "Direction commerciale",
      },
    },
  });
  expect(createError).toBeNull();
  expect(created.user).toBeTruthy();

  const userId = created.user!.id;
  const { error: profileError } = await admin
    .from("user_profiles")
    .update({ full_name: "Direction Autonome", onboarding_completed_at: new Date().toISOString() })
    .eq("user_id", userId);
  expect(profileError).toBeNull();

  await page.goto("/login");
  await page.getByLabel("Email professionnel").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/setup$/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Créer votre espace marque" })).toBeVisible();

  await expect(page.getByLabel("Raison sociale")).toHaveValue(companyName);
  await page.getByLabel("Nom de la marque").fill(brandName);
  await page.getByLabel("Code marque").fill(brandCode);
  await page.getByRole("button", { name: "Créer mon espace brouillon" }).click();

  let brandId = "";
  await expect.poll(async () => {
    const { data } = await admin.from("brands").select("id").eq("code", brandCode).maybeSingle();
    brandId = data?.id ?? "";
    return brandId;
  }, { timeout: 60_000 }).not.toBe("");

  await page.goto("/setup");
  await expect(page.getByRole("heading", { name: `Configurer ${brandName}` })).toBeVisible();
  await expect(page.getByText("1. Équipe", { exact: true })).toBeVisible();
  await expect(page.getByText("2. Territoires", { exact: true })).toBeVisible();
  await expect(page.getByText("3. Pharmacies", { exact: true })).toBeVisible();
  await expect(page.getByText("4. Produits", { exact: true })).toBeVisible();
  await expect(page.getByText("5. Configuration commerciale", { exact: true })).toBeVisible();
  await expect(page.getByText("6. Vérification et activation", { exact: true })).toBeVisible();

  const [{ data: brand }, { data: request }, { data: onboarding }, { data: entitlement }, { data: membership }] = await Promise.all([
    admin.from("brands").select("status,is_active,organization_id").eq("id", brandId).single(),
    admin.from("access_requests").select("status,target_brand_id,review_source").eq("user_id", userId).single(),
    admin.from("brand_onboarding_sessions").select("onboarding_mode,owner_user_id,status,current_step").eq("brand_id", brandId).single(),
    admin.from("brand_saas_entitlements").select("status,saas_plans!inner(key)").eq("brand_id", brandId).single(),
    admin.from("memberships").select("status,roles!inner(key)").eq("brand_id", brandId).eq("user_id", userId).single(),
  ]);

  expect(brand).toMatchObject({ status: "draft", is_active: false });
  expect(request).toMatchObject({ status: "approved", target_brand_id: brandId, review_source: "self_service" });
  expect(onboarding).toMatchObject({ onboarding_mode: "self_service", owner_user_id: userId, status: "in_progress", current_step: "users" });
  expect(entitlement?.status).toBe("trialing");
  expect(membership?.status).toBe("active");

  const roles = Array.isArray(membership?.roles) ? membership.roles : [membership?.roles];
  expect(roles.some((role) => role?.key === "brand_admin")).toBe(true);
});
