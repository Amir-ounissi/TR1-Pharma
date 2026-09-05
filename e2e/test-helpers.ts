import { createClient } from "@supabase/supabase-js";
import { expect, type Page } from "@playwright/test";

export const password = "DemoTR1!2026";

function requiredEnvironment(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for E2E tests.`);
  return value;
}

export function adminClient() {
  return createClient(requiredEnvironment("NEXT_PUBLIC_SUPABASE_URL"), requiredEnvironment("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function userClient(email: string) {
  const client = createClient(requiredEnvironment("NEXT_PUBLIC_SUPABASE_URL"), requiredEnvironment("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"), { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return client;
}

export async function signIn(page: Page, email: string, brand: RegExp | string) {
  await page.goto("/login");
  await page.getByLabel("Email professionnel").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/(?:select-brand|dashboard(?:\/(?:agent|field))?)$/, { timeout: 30_000 });

  const landingPath = new URL(page.url()).pathname;
  if (landingPath === "/dashboard/field") return;

  if (landingPath !== "/select-brand") {
    await page.goto("/select-brand");
  }
  await page.getByRole("button", { name: brand }).click();
  await expect(page).toHaveURL(/\/dashboard(?:\/(?:agent|field))?$/, { timeout: 30_000 });
}

export async function chooseCombobox(page: Page, formSelector: string, index: number, option: RegExp | string) {
  const form = page.locator(formSelector);
  await form.getByRole("combobox").nth(index).click();
  await page.getByRole("option", { name: option }).click();
}
