import { notFound } from "next/navigation";
import { TerritoryEditForm } from "@/components/reference/simple-forms";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireActiveBrand } from "@/lib/auth";
export default async function TerritoryEditPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; const { supabase, brand } = await requireActiveBrand(); const { data: territory } = await supabase.from("territories").select("*").eq("id", id).eq("brand_id", brand.id).maybeSingle(); if (!territory) notFound(); return <div className="space-y-6"><h1 className="text-2xl font-semibold tracking-tight">Modifier {territory.name}</h1><Card><CardHeader><CardTitle>Territoire</CardTitle></CardHeader><CardContent><TerritoryEditForm territory={territory} /></CardContent></Card></div>; }
