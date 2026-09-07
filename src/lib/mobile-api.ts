import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { getPublicSupabaseEnv } from "@/lib/supabase/env";

export class MobileApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

type BrandContextRow = {
  brand_id: string;
  brand_name: string;
  brand_slug: string;
  role_key: string;
};

type CapabilityRow = {
  capability_key: string;
  enabled: boolean;
};

export type MobileBrandContext = {
  supabase: SupabaseClient;
  user: User;
  brand: {
    id: string;
    name: string;
    slug: string;
    role: string;
  };
};

function readBearerToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match?.[1]) throw new MobileApiError(401, "Session mobile manquante.");
  return match[1];
}

export async function requireMobileBrand(request: Request, brandId: string): Promise<MobileBrandContext> {
  if (!brandId) throw new MobileApiError(400, "Marque manquante.");
  const token = readBearerToken(request);
  const { url, publishableKey } = getPublicSupabaseEnv();
  const supabase = createClient(url, publishableKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) throw new MobileApiError(401, "Session mobile invalide ou expirée.");

  const { data: contexts, error: contextsError } = await supabase.rpc("get_my_brand_contexts");
  if (contextsError) throw new MobileApiError(403, "Les accès TR1 ne sont pas disponibles.");
  const row = ((contexts ?? []) as BrandContextRow[]).find((context) => context.brand_id === brandId);
  if (!row) throw new MobileApiError(403, "Vous n’avez pas accès à cette marque.");

  return {
    supabase,
    user: userData.user,
    brand: { id: row.brand_id, name: row.brand_name, slug: row.brand_slug, role: row.role_key },
  };
}

export async function requireMobileCapability(supabase: SupabaseClient, brandId: string, capability: string) {
  const { data, error } = await supabase.rpc("get_my_brand_capabilities", { target_brand_id: brandId });
  if (error) throw new MobileApiError(403, "Les droits de la marque ne sont pas disponibles.");
  const enabled = ((data ?? []) as CapabilityRow[]).some((row) => row.capability_key === capability && row.enabled);
  if (!enabled) throw new MobileApiError(403, "Cette fonctionnalité n’est pas activée pour la marque.");
}

export function mobileApiError(error: unknown) {
  if (error instanceof MobileApiError) return Response.json({ error: error.message }, { status: error.status });
  return Response.json({ error: "Une erreur mobile TR1 est survenue." }, { status: 500 });
}
