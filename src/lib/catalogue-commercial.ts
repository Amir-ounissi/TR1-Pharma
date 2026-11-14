import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type CommercialQuantityGroup = {
  id: string;
  brand_slug: string;
  name: string;
  product_ids: string[];
  minimum_total_units: number;
  quantity_multiple: number;
};

export type CommercialGiftRule = {
  minimum_order_units: number;
  free_units: number;
  description?: string;
};

export type CommercialSupplier = {
  id: string;
  name: string;
  brand_slugs: string[];
  conditions_verified: boolean;
  minimum_order_units: number | null;
  minimum_order_ht: number | null;
  shipping_fee_ht: number | null;
  free_shipping_from_ht: number | null;
  gift_rules: CommercialGiftRule[];
};

export type CommercialContext = {
  quantity_groups: CommercialQuantityGroup[];
  suppliers: CommercialSupplier[];
};

/** Toutes les règles retournées sont déjà limitées aux marques autorisées à l'officine. */
export async function getCommercialContext(
  client: SupabaseClient,
  accessLinkHash?: string | null,
): Promise<CommercialContext> {
  const { data, error } = accessLinkHash
    ? await client.rpc("catalogue_commercial_context_for_private_link", { p_token_hash: accessLinkHash })
    : await client.rpc("catalogue_commercial_context");
  if (error) throw error;
  const context = data as CommercialContext | null;
  return {
    quantity_groups: context?.quantity_groups ?? [],
    suppliers: context?.suppliers ?? [],
  };
}
