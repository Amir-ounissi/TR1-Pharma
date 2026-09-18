import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { adminClient, password } from "./test-helpers";

const suffix = Date.now().toString().slice(-8);
const email = `password-recovery-${suffix}@tr1.local`;
const newPassword = "RecoveryTR1!2026";

async function getRecoveryLink(targetEmail: string) {
  return expect.poll(async () => {
    const listResponse = await fetch("http://127.0.0.1:54324/api/v1/messages");
    if (!listResponse.ok) return "";

    const list = await listResponse.json() as {
      messages: Array<{ ID: string; To: Array<{ Address: string }> }>;
    };
    const message = list.messages.find((candidate) =>
      candidate.To.some((recipient) => recipient.Address === targetEmail),
    );
    if (!message) return "";

    const messageResponse = await fetch(`http://127.0.0.1:54324/api/v1/message/${message.ID}`);
    if (!messageResponse.ok) return "";

    const body = await messageResponse.json() as { HTML: string };
    return body.HTML.match(/href="([^"]+)"/i)?.[1]?.replaceAll("&amp;", "&") ?? "";
  }, { timeout: 30_000 }).not.toBe("").then(async () => {
    const listResponse = await fetch("http://127.0.0.1:54324/api/v1/messages");
    const list = await listResponse.json() as {
      messages: Array<{ ID: string; To: Array<{ Address: string }> }>;
    };
    const message = list.messages.find((candidate) =>
      candidate.To.some((recipient) => recipient.Address === targetEmail),
    );
    if (!message) throw new Error("Recovery email is unavailable.");

    const messageResponse = await fetch(`http://127.0.0.1:54324/api/v1/message/${message.ID}`);
    const body = await messageResponse.json() as { HTML: string };
    const link = body.HTML.match(/href="([^"]+)"/i)?.[1]?.replaceAll("&amp;", "&");
    if (!link) throw new Error("Recovery link is unavailable.");
    return link;
  });
}

test("mot de passe oublié — demande, email, nouveau mot de passe et reconnexion", async ({ page }) => {
  test.setTimeout(120_000);

  const admin = adminClient();
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  expect(createError).toBeNull();
  expect(created.user).toBeTruthy();

  try {
    await page.goto("/login");
    const forgotLink = page.getByRole("link", { name: "Mot de passe oublié ?" });
    await expect(forgotLink).toBeVisible();
    await forgotLink.click();

    await expect(page).toHaveURL(/\/forgot-password$/);
    await expect(page.getByRole("heading", { name: "Réinitialisez votre mot de passe." })).toBeVisible();

    await page.getByLabel("Email professionnel").fill(email);
    await page.getByRole("button", { name: "Envoyer le lien de réinitialisation" }).click();
    await expect(page.getByText(/un email de réinitialisation vient d’être envoyé/i)).toBeVisible();

    const recoveryLink = await getRecoveryLink(email);
    await page.goto(recoveryLink);

    await expect(page).toHaveURL(/\/reset-password(?:#|$)/, { timeout: 30_000 });
    await expect(page.getByRole("heading", { name: "Choisissez un nouveau mot de passe." })).toBeVisible();
    await expect(page.getByLabel("Nouveau mot de passe")).toBeVisible();

    await page.getByLabel("Nouveau mot de passe").fill(newPassword);
    await page.getByLabel("Confirmer le mot de passe").fill(newPassword);
    await page.getByRole("button", { name: "Enregistrer le nouveau mot de passe" }).click();

    await expect(page).toHaveURL(/\/login\?password=updated$/, { timeout: 30_000 });
    await expect(page.getByText("Votre mot de passe a bien été modifié. Vous pouvez vous connecter.")).toBeVisible();

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!supabaseUrl || !publishableKey) throw new Error("Supabase E2E environment is missing.");

    const client = createClient(supabaseUrl, publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: signInError } = await client.auth.signInWithPassword({ email, password: newPassword });
    expect(signInError).toBeNull();
  } finally {
    if (created.user?.id) await admin.auth.admin.deleteUser(created.user.id);
  }
});
