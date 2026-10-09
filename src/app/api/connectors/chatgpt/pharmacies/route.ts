import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getPublicSupabaseEnv } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  q: z.string().trim().min(2).max(120),
  brand_id: z.string().uuid(),
});

export async function GET(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  const token = /^Bearer (\S+)$/i.exec(auth)?.[1];
  if (!token) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const url = new URL(request.url);
  const input = querySchema.safeParse({
    q: url.searchParams.get("q"),
    brand_id: url.searchParams.get("brand_id"),
  });
  if (!input.success) return NextResponse.json({ error: "Invalid query" }, { status: 400 });

  const { url: supabaseUrl, publishableKey } = getPublicSupabaseEnv();
  const supabase = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: identity, error: identityError } = await supabase.auth.getUser(token);
  if (identityError || !identity.user) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  const { data: contexts, error: contextError } = await supabase.rpc("get_my_brand_contexts");
  if (contextError) return NextResponse.json({ error: "Authorization unavailable" }, { status: 503 });
  const authorized = (contexts ?? []).some(
    (context: { brand_id: string }) => context.brand_id === input.data.brand_id,
  );
  if (!authorized) return NextResponse.json({ error: "Brand not authorized" }, { status: 403 });

  const { data, error } = await supabase.rpc("search_authorized_pharmacies", {
    target_brand_id: input.data.brand_id,
    search_text: input.data.q,
    result_limit: 10,
  });
  if (error) return NextResponse.json({ error: "Search unavailable" }, { status: 503 });
  return NextResponse.json({ pharmacies: data ?? [] }, {
    headers: { "Cache-Control": "no-store" },
  });
}
