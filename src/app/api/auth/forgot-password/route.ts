import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getPublicSupabaseEnv } from "@/lib/supabase/env";

const requestSchema = z.object({
  email: z.string().trim().email(),
});

const RECOVERY_TIMEOUT_MS = 12_000;

export async function POST(request: NextRequest) {
  let payload: z.infer<typeof requestSchema>;

  try {
    payload = requestSchema.parse(await request.json());
  } catch {
    return NextResponse.json(
      { error: "Adresse email invalide." },
      { status: 400 },
    );
  }

  const { url, publishableKey } = getPublicSupabaseEnv();
  const supabase = createClient(url, publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const timeout = new Promise<never>((_, reject) => {
    setTimeout(
      () => reject(new Error("password_recovery_timeout")),
      RECOVERY_TIMEOUT_MS,
    );
  });

  try {
    const result = await Promise.race([
      supabase.auth.resetPasswordForEmail(payload.email, {
        redirectTo: `${request.nextUrl.origin}/reset-password`,
      }),
      timeout,
    ]);

    if (result.error) {
      console.error("Password recovery request failed", {
        status: result.error.status,
        code: result.error.code,
      });

      return NextResponse.json(
        { error: "Impossible d’envoyer le lien pour le moment." },
        { status: result.error.status === 429 ? 429 : 503 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Password recovery request timed out or failed", error);

    return NextResponse.json(
      { error: "Impossible d’envoyer le lien pour le moment." },
      { status: 503 },
    );
  }
}
