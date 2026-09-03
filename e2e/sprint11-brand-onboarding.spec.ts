import { mkdirSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { adminClient, password, signIn, userClient } from "./test-helpers";

const suffix = Date.now().toString().slice(-7);
const brandCode = `S11_${suffix}`;
const brandName = `Marque Sprint 11 ${suffix}`;
const organizationName = `Laboratoire Sprint 11 ${suffix}`;
const brandAdminEmail = `brand-admin-${suffix}@tr1.local`;
const importedUserEmail = `brand-user-${suffix}@tr1.local`;
const productCode = `S11-${suffix}`;
const pharmacyExternalId = `PHA-${suffix}`;
let brandId = "";
let organizationId = "";

async function getInvitationLink(email: string) {
  const listResponse = await fetch("http://127.0.0.1:54324/api/v1/messages");
  if (!listResponse.ok) throw new Error("Inbucket is unavailable");
  const list = await listResponse.json() as { messages: Array<{ ID: string; To: Array<{ Address: string }> }> };
  const message = list.messages.find((candidate) => candidate.To.some((recipient) => recipient.Address === email));
  if (!message) throw new Error("Invitation email is not available yet");

  const messageResponse = await fetch(`http://127.0.0.1:54324/api/v1/message/${message.ID}`);
  if (!messageResponse.ok) throw new Error("Invitation email cannot be read");
  const content = await messageResponse.json() as { HTML: string };
  const url = content.HTML.match(/href="([^"]+)"/i)?.[1]?.replaceAll("&amp;", "&");
  if (!url) throw new Error("Invitation link is missing");
  return url;
}

async function openConsole(page: Page) {
  await page.goto(`/dashboard/admin/onboarding${brandId ? `?brand=${brandId}` : ""}`);
  await expect(page.getByRole("heading", { name: "Onboarding d’une marque" })).toBeVisible();
}

async function stageImport(page: Page, options: {
  type: "products" | "pharmacies" | "orders" | "users" | "territories";
  mode: "create_only" | "update_only" | "upsert" | "append_only" | "invite";
  fileName: string;
  content: string;
  executable?: boolean;
}) {
  await page.goto(`/dashboard/admin/onboarding?brand=${brandId}`);
  const importCard = page.getByTestId("onboarding-import-card");
  await importCard.getByLabel("Données à importer").selectOption(options.type);
  await importCard.getByLabel("Mode").selectOption(options.mode);
  await importCard.getByLabel(/Fichier CSV UTF-8/).setInputFiles({
    name: options.fileName,
    mimeType: "text/csv",
    buffer: Buffer.from(options.content),
  });
  await expect(importCard.getByText(/1 lignes/)).toBeVisible();
  await importCard.getByRole("button", { name: "Valider la prévisualisation" }).click();
  const admin = adminClient();
  await expect.poll(async () => {
    const { data } = await admin
      .from("import_batches")
      .select("id,lifecycle_status")
      .eq("brand_id", brandId)
      .eq("file_name", options.fileName)
      .single();
    return data?.lifecycle_status;
  }).toBe(options.executable === false ? "review" : "ready");
  const { data: stagedBatch } = await admin
    .from("import_batches")
    .select("id")
    .eq("brand_id", brandId)
    .eq("file_name", options.fileName)
    .single();
  expect(stagedBatch?.id).toBeTruthy();
  expect((await admin.from("import_rows").select("*", { count: "exact", head: true }).eq("batch_id", stagedBatch!.id)).count).toBe(1);
  await page.goto(`/dashboard/admin/onboarding?brand=${brandId}`);
  const row = page.getByRole("row").filter({ hasText: options.fileName });
  await expect(row).toBeVisible();
  if (options.executable === false) {
    await expect(row.getByRole("button", { name: "Exécuter l’import" })).toHaveCount(0);
    return row;
  }
  await row.getByRole("button", { name: "Exécuter l’import" }).click();
  await expect.poll(async () => {
    const { data } = await admin
      .from("import_batches")
      .select("lifecycle_status")
      .eq("brand_id", brandId)
      .eq("file_name", options.fileName)
      .single();
    return data?.lifecycle_status;
  }).toMatch(/^completed/);
  await page.goto(`/dashboard/admin/onboarding?brand=${brandId}`);
  const completedRow = page.getByRole("row").filter({ hasText: options.fileName });
  await expect(completedRow.getByText(/Terminé/)).toBeVisible();
  return completedRow;
}

test.describe.serial("Sprint 11 — Onboarding marque et imports contrôlés", () => {
  test.setTimeout(480_000);
  test.beforeAll(() => mkdirSync("artifacts/sprint11", { recursive: true }));

  test("scénario 1 — création, configuration, référentiels, utilisateur et activation", async ({ page }) => {
    await signIn(page, "superadmin@tr1.local", /Dermavita/);
    await openConsole(page);
    await page.getByLabel("Nom légal").fill(organizationName);
    await page.getByLabel("Nom commercial").fill(organizationName);
    await page.getByLabel("Nom de la marque").fill(brandName);
    await page.getByLabel("Code interne").fill(brandCode);
    await page.getByRole("button", { name: "Créer l’organisation et la marque" }).click();

    const admin = adminClient();
    await expect.poll(async () => {
      const { data } = await admin.from("brands").select("id,organization_id").eq("code", brandCode).maybeSingle();
      brandId = data?.id ?? "";
      organizationId = data?.organization_id ?? "";
      return brandId;
    }, { timeout: 60_000 }).not.toBe("");
    await page.goto(`/dashboard/admin/onboarding?brand=${brandId}`);

    await page.getByLabel("Intervalle de réassort (jours)").fill("55");
    await page.getByRole("button", { name: "Enregistrer les paramètres" }).click();
    await expect.poll(async () => (await admin.from("brand_settings").select("default_reorder_interval_days").eq("brand_id", brandId).single()).data?.default_reorder_interval_days).toBe(55);
    await page.goto(`/dashboard/admin/onboarding?brand=${brandId}`);

    await stageImport(page, {
      type: "products",
      mode: "create_only",
      fileName: `produits-${suffix}.csv`,
      content: `sku;ean;name;description;product_family;format;wholesale_price_ht;retail_price_ttc;tax_rate;units_per_case;minimum_order_quantity;strategic_priority;counts_for_distribution;is_active\n${productCode};;Produit Onboarding;Produit de test;Dermocosmétique;Boîte;19.90;29.90;20;1;1;;oui;oui`,
    });
    await stageImport(page, {
      type: "territories",
      mode: "create_only",
      fileName: `territoires-${suffix}.csv`,
      content: `territory_code;territory_name;country;department_or_region;manager_email\nT-${suffix};Territoire pilote;FR;Île-de-France;`,
    });
    await stageImport(page, {
      type: "pharmacies",
      mode: "create_only",
      fileName: `pharmacies-${suffix}.csv`,
      content: `external_id;pharmacy_name;address_line_1;address_line_2;postal_code;city;country;phone;email;group_name;potential;strategic;territory_code\n${pharmacyExternalId};Pharmacie Onboarding;1 rue Pilote;;75001;Paris;FR;+33102030405;pilote-${suffix}@pharma.local;;high;oui;T-${suffix}`,
    });

    await page.getByLabel("Nom complet").fill("Admin Marque Pilote");
    await page.getByLabel("E-mail").fill(brandAdminEmail);
    await page.getByRole("button", { name: "Envoyer l’invitation" }).click();
    await expect.poll(async () => (await admin.from("users").select("id").eq("email", brandAdminEmail).maybeSingle()).data?.id ?? "").not.toBe("");

    await stageImport(page, {
      type: "users",
      mode: "invite",
      fileName: `utilisateurs-${suffix}.csv`,
      content: `email;first_name;last_name;role;territory_code;active\n${importedUserEmail};Utilisateur;Importé;brand_user;T-${suffix};oui`,
    });

    await expect(page.getByText("Votre espace peut être activé")).toBeVisible();
    await page.screenshot({ path: "artifacts/sprint11/onboarding-ready-desktop.png", fullPage: true });
    await page.getByRole("button", { name: "Activer l’espace" }).click();
    await expect.poll(async () => (
      await admin.from("brands").select("status").eq("id", brandId).single()
    ).data?.status).toBe("active");
    await page.goto(`/dashboard/admin/onboarding?brand=${brandId}`);
    await expect(page.getByText("Marque activée")).toBeVisible();

    await expect.poll(async () => (
      await admin.from("memberships").select("status").eq("user_id", (await admin.from("users").select("id").eq("email", brandAdminEmail).single()).data!.id).eq("brand_id", brandId).single()
    ).data?.status).toBe("invited");
    await expect.poll(async () => {
      try {
        return await getInvitationLink(brandAdminEmail);
      } catch {
        return "";
      }
    }).not.toBe("");
    const invitationLink = await getInvitationLink(brandAdminEmail);
    expect(invitationLink).toContain("/auth/confirm?next=/onboarding&token_hash=");

    const brandAdminContext = await page.context().browser()!.newContext();
    const brandAdminPage = await brandAdminContext.newPage();
    await brandAdminPage.goto(invitationLink);
    await expect(brandAdminPage).toHaveURL(/\/onboarding$/);
    await expect(brandAdminPage.getByLabel("Mot de passe", { exact: true })).toBeVisible();
    await brandAdminPage.goto("/dashboard");
    await expect(brandAdminPage).toHaveURL(/\/onboarding$/);
    await brandAdminPage.getByLabel("Nom complet").fill("Admin Marque Pilote");
    await brandAdminPage.getByLabel("Mot de passe", { exact: true }).fill(password);
    await brandAdminPage.getByLabel("Confirmer le mot de passe").fill(password);
    await brandAdminPage.getByRole("button", { name: "Continuer" }).click();
    await expect(brandAdminPage).toHaveURL(/\/select-brand$/);
    await expect.poll(async () => (
      await admin.from("memberships").select("status").eq("user_id", (await admin.from("users").select("id").eq("email", brandAdminEmail).single()).data!.id).eq("brand_id", brandId).single()
    ).data?.status).toBe("active");
    const { data: brandAdminUser } = await admin.from("users").select("id").eq("email", brandAdminEmail).single();
    expect(brandAdminUser).toBeTruthy();
    const [{ data: profile }, { count: activePlatformMemberships }] = await Promise.all([
      admin.from("user_profiles").select("full_name,onboarding_completed_at").eq("user_id", brandAdminUser!.id).single(),
      admin.from("memberships").select("id", { count: "exact", head: true }).eq("user_id", brandAdminUser!.id).is("brand_id", null).eq("status", "active"),
    ]);
    expect(profile).toMatchObject({ full_name: "Admin Marque Pilote" });
    expect(profile?.onboarding_completed_at).toBeTruthy();
    expect(activePlatformMemberships).toBe(0);
    await brandAdminPage.getByRole("button", { name: brandName, exact: false }).click();
    await expect(brandAdminPage).toHaveURL(/\/dashboard$/);
    await brandAdminPage.getByRole("button", { name: "Déconnexion", exact: true }).click();
    await expect(brandAdminPage).toHaveURL(/\/login$/);
    await signIn(brandAdminPage, brandAdminEmail, new RegExp(brandName));
    await expect(brandAdminPage.getByText(brandName).first()).toBeVisible();
    await brandAdminContext.close();

    const { data: importedUser } = await admin.from("users").select("id").eq("email", importedUserEmail).single();
    expect(importedUser).toBeTruthy();
    const [{ count: products }, { count: pharmacies }, { count: importedMemberships }, { data: brand }] = await Promise.all([
      admin.from("products").select("*", { count: "exact", head: true }).eq("brand_id", brandId).eq("sku", productCode),
      admin.from("brand_pharmacies").select("*", { count: "exact", head: true }).eq("brand_id", brandId).eq("external_id", pharmacyExternalId),
      admin.from("memberships").select("*", { count: "exact", head: true }).eq("brand_id", brandId).eq("user_id", importedUser!.id),
      admin.from("brands").select("status,activated_at").eq("id", brandId).single(),
    ]);
    expect({ products, pharmacies, importedMemberships }).toEqual({ products: 1, pharmacies: 1, importedMemberships: 1 });
    expect(brand).toMatchObject({ status: "active" });
    expect(brand?.activated_at).toBeTruthy();
  });

  test("scénario 2 — ligne invalide bloque tout le lot puis correction", async ({ page }) => {
    await signIn(page, "superadmin@tr1.local", /Dermavita/);
    await openConsole(page);
    await stageImport(page, {
      type: "pharmacies",
      mode: "create_only",
      fileName: `pharmacies-invalides-${suffix}.csv`,
      content: `external_id;pharmacy_name;address_line_1;postal_code;city;country\nBAD-${suffix};Pharmacie Invalide;2 rue Test;75002;;FR`,
      executable: false,
    });
    const admin = adminClient();
    expect((await admin.from("brand_pharmacies").select("*", { count: "exact", head: true }).eq("brand_id", brandId).eq("external_id", `BAD-${suffix}`)).count).toBe(0);
    await stageImport(page, {
      type: "pharmacies",
      mode: "create_only",
      fileName: `pharmacies-corrigees-${suffix}.csv`,
      content: `external_id;pharmacy_name;address_line_1;postal_code;city;country\nFIX-${suffix};Pharmacie Corrigée;2 rue Test;75002;Paris;FR`,
    });
    expect((await admin.from("brand_pharmacies").select("*", { count: "exact", head: true }).eq("brand_id", brandId).eq("external_id", `FIX-${suffix}`)).count).toBe(1);
  });

  test("scénario 3 — doublon pharmacie résolu par mise à jour sans duplication", async ({ page }) => {
    await signIn(page, "superadmin@tr1.local", /Dermavita/);
    await openConsole(page);
    await stageImport(page, {
      type: "pharmacies",
      mode: "upsert",
      fileName: `pharmacies-update-${suffix}.csv`,
      content: `external_id;pharmacy_name;address_line_1;postal_code;city;country\n${pharmacyExternalId};Pharmacie Onboarding Mise à jour;1 rue Pilote;75001;Paris;FR`,
    });
    const admin = adminClient();
    const { data: relations, count } = await admin.from("brand_pharmacies").select("pharmacy_id", { count: "exact" }).eq("brand_id", brandId).eq("external_id", pharmacyExternalId);
    expect(count).toBe(1);
    const { data: pharmacy } = await admin.from("pharmacies").select("legal_name").eq("id", relations![0].pharmacy_id).single();
    expect(pharmacy?.legal_name).toBe("Pharmacie Onboarding Mise à jour");
  });

  test("scénario 4 — commandes historiques alimentent CA et santé commerciale", async ({ page }) => {
    await signIn(page, "superadmin@tr1.local", /Dermavita/);
    await openConsole(page);
    await stageImport(page, {
      type: "orders",
      mode: "append_only",
      fileName: `commandes-${suffix}.csv`,
      content: `external_order_id;pharmacy_external_id;order_date;status;total_ht;currency;product_code;quantity;salesperson_email\nORDER-${suffix};${pharmacyExternalId};2026-06-15;invoiced;199;EUR;${productCode};10;${brandAdminEmail}`,
    });
    const admin = adminClient();
    const { data: order } = await admin.from("orders").select("id,net_amount_ht,brand_pharmacy_id,source").eq("brand_id", brandId).eq("external_order_id", `ORDER-${suffix}`).single();
    expect(order).toMatchObject({ net_amount_ht: 199, source: "import" });
    const { data: health, error: healthError } = await admin
      .from("commercial_account_health")
      .select("brand_pharmacy_id,total_revenue")
      .eq("brand_pharmacy_id", order!.brand_pharmacy_id)
      .single();
    expect(healthError).toBeNull();
    expect(Number(health?.total_revenue)).toBeGreaterThanOrEqual(199);
    expect(health?.brand_pharmacy_id).toBe(order!.brand_pharmacy_id);
  });

  test("scénario 5 — rollback contrôlé et audit", async ({ page }) => {
    await signIn(page, "superadmin@tr1.local", /Dermavita/);
    await openConsole(page);
    const fileName = `territoire-rollback-${suffix}.csv`;
    const row = await stageImport(page, {
      type: "territories",
      mode: "create_only",
      fileName,
      content: `territory_code;territory_name;country;department_or_region;manager_email\nRB-${suffix};Territoire rollback;FR;Sud;`,
    });
    await row.getByRole("button", { name: "Rollback" }).click();
    const admin = adminClient();
    await expect.poll(async () => (
      await admin.from("import_batches").select("lifecycle_status").eq("brand_id", brandId).eq("file_name", fileName).single()
    ).data?.lifecycle_status).toBe("rolled_back");
    await page.goto(`/dashboard/admin/onboarding?brand=${brandId}`);
    await expect(page.getByRole("row").filter({ hasText: fileName }).getByText("Annulé proprement")).toBeVisible();
    expect((await admin.from("territories").select("*", { count: "exact", head: true }).eq("brand_id", brandId).eq("code", `RB-${suffix}`)).count).toBe(0);
    expect((await admin.from("onboarding_audit_logs").select("*", { count: "exact", head: true }).eq("brand_id", brandId).eq("event_name", "import_rolled_back")).count).toBeGreaterThan(0);
  });

  test("scénario 6 — cloisonnement page, jobs et fichier source", async ({ page }) => {
    const admin = adminClient();
    const { data: sourceJob } = await admin.from("import_batches").select("id,source_path").eq("brand_id", brandId).not("source_path", "is", null).limit(1).single();
    expect(sourceJob?.source_path).toBeTruthy();
    const otherBrand = await userClient("admin@nutrilab.local");
    const agent = await userClient("agent@dermavita.local");
    expect((await otherBrand.from("import_batches").select("id").eq("brand_id", brandId)).data).toEqual([]);
    expect((await agent.from("import_batches").select("id").eq("brand_id", brandId)).data).toEqual([]);
    expect((await otherBrand.storage.from("onboarding-imports").createSignedUrl(sourceJob!.source_path!, 60)).error).toBeTruthy();
    expect((await agent.storage.from("onboarding-imports").createSignedUrl(sourceJob!.source_path!, 60)).error).toBeTruthy();

    await signIn(page, "agent@dermavita.local", /Dermavita/);
    await page.goto("/dashboard/admin/onboarding");
    await expect(page).toHaveURL(/\/dashboard$/);

    const { data: buckets } = await admin.storage.listBuckets();
    expect(buckets?.find((bucket) => bucket.id === "onboarding-imports")?.public).toBe(false);
    expect(organizationId).toBeTruthy();
  });

  test("scénario 7 — export tenant-scoped neutralise les formules tableur", async ({ page }) => {
    const admin = adminClient();
    const maliciousSku = `CSV-${suffix}`;
    const { error } = await admin.from("products").insert({
      brand_id: brandId,
      sku: maliciousSku,
      name: "=HYPERLINK(\"https://example.invalid\")",
      category: "Test sécurité",
      is_active: true,
    });
    expect(error).toBeNull();

    await signIn(page, "superadmin@tr1.local", /Dermavita/);
    const response = await page.request.get(`/api/onboarding/export/${brandId}/products`);
    expect(response.status()).toBe(200);
    const csv = await response.text();
    expect(csv).toContain(`"${maliciousSku}"`);
    expect(csv).toContain(`"'=HYPERLINK(""https://example.invalid"")"`);
    expect(csv).not.toContain(`;"=HYPERLINK(`);
  });
});
