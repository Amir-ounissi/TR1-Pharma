import type { NextRequest } from "next/server";
import { recordsToCsv } from "@/lib/imports/control-export";
import type { ImportType } from "@/lib/imports/import-types";
import { requirePlatformAdmin } from "@/lib/auth";

const allowedTypes = new Set<ImportType>(["products", "pharmacies", "orders", "users", "territories"]);

export async function GET(_request: NextRequest, { params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  if (!allowedTypes.has(type as ImportType)) return new Response("Modèle inconnu.", { status: 404 });
  const { supabase } = await requirePlatformAdmin();
  const { data: template } = await supabase
    .from("import_templates")
    .select("csv_header")
    .eq("import_type", type)
    .eq("is_active", true)
    .single();
  if (!template) return new Response("Modèle indisponible.", { status: 404 });
  const headers = template.csv_header.split(";");
  const csv = recordsToCsv([], headers);
  return new Response(`\uFEFF${csv}\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="modele-${type}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
