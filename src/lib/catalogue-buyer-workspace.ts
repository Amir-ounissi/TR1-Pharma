import "server-only";

import { createClient } from "@/lib/supabase/server";

export type SavedCartLine = {
  product_id: string;
  quantity: number;
};

export type ReorderRequest = {
  id: string;
  created_at: string;
  brand_name: string;
  request_kind: "quote" | "order";
  status: string;
  items: (SavedCartLine & { name: string })[];
};

export type BuyerWorkspace = {
  lines: SavedCartLine[];
  recent_requests: ReorderRequest[];
};

export async function getBuyerWorkspace(
  client: Awaited<ReturnType<typeof createClient>>,
): Promise<BuyerWorkspace> {
  const { data, error } = await client.rpc("catalogue_buyer_workspace");
  if (error) throw error;
  const value = data as BuyerWorkspace | null;
  return {
    lines: value?.lines ?? [],
    recent_requests: value?.recent_requests ?? [],
  };
}
