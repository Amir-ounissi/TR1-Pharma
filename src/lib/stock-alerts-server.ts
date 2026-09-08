import "server-only";
import type { requireActiveBrand } from "@/lib/auth";
import { stockCoverage } from "@/lib/stock-coverage";

export type StockAlert = {
  brand_pharmacy_id: string;
  agent_id: string | null;
  pharmacy_name: string;
  product_name: string;
  days_until_rupture: number;
  stock_current: number;
  monthly_average: number;
  last_updated: string;
};

type ActiveSupabase = Awaited<ReturnType<typeof requireActiveBrand>>["supabase"];

export async function loadStockAlerts(
  supabase: ActiveSupabase,
  brandId: string,
  userId?: string,
): Promise<StockAlert[]> {
  let pharmacyQuery = supabase
    .from("brand_pharmacies")
    .select("id,current_agent_user_id,pharmacies!brand_pharmacies_pharmacy_id_fkey(trade_name,legal_name,city)")
    .eq("brand_id", brandId)
    .is("archived_at", null)
    .limit(1000);

  if (userId) pharmacyQuery = pharmacyQuery.eq("current_agent_user_id", userId);
  const { data: pharmacies, error: pharmacyError } = await pharmacyQuery;
  if (pharmacyError) throw pharmacyError;

  const pharmacyIds = (pharmacies ?? []).map((row) => row.id);
  if (!pharmacyIds.length) return [];

  const { data: captures, error: captureError } = await supabase
    .from("sell_out_captures")
    .select("id,brand_pharmacy_id,period_end")
    .in("brand_pharmacy_id", pharmacyIds)
    .eq("brand_id", brandId)
    .eq("status", "validated")
    .is("archived_at", null)
    .order("period_end", { ascending: false })
    .limit(3000);
  if (captureError) throw captureError;
  if (!(captures ?? []).length) return [];

  const { data: lines, error: lineError } = await supabase
    .from("sell_out_lines")
    .select("capture_id,product_id,label,ean,units_sold,stock_current")
    .in("capture_id", (captures ?? []).map((capture) => capture.id));
  if (lineError) throw lineError;

  const alerts = (pharmacies ?? []).flatMap((pharmacy) => {
    const nested = Array.isArray(pharmacy.pharmacies) ? pharmacy.pharmacies[0] : pharmacy.pharmacies;
    const pharmacyCaptures = (captures ?? []).filter((capture) => capture.brand_pharmacy_id === pharmacy.id);
    const captureIds = new Set(pharmacyCaptures.map((capture) => capture.id));
    const pharmacyLines = (lines ?? []).filter((line) => captureIds.has(line.capture_id));

    return stockCoverage(pharmacyCaptures, pharmacyLines)
      .filter((coverage) => coverage.days <= 45)
      .map((coverage) => ({
        brand_pharmacy_id: pharmacy.id,
        agent_id: pharmacy.current_agent_user_id as string | null,
        pharmacy_name: nested?.trade_name || nested?.legal_name || "Pharmacie",
        product_name: coverage.name,
        days_until_rupture: coverage.days,
        stock_current: coverage.stock,
        monthly_average: coverage.average,
        last_updated: coverage.date,
      }));
  });

  return alerts
    .sort((a, b) => a.days_until_rupture - b.days_until_rupture)
    .slice(0, 50);
}
