import { notFound } from "next/navigation";
import { GroupEditForm } from "@/components/reference/simple-forms";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireActiveBrand } from "@/lib/auth";
export default async function GroupEditPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; const { supabase } = await requireActiveBrand(); const { data: group } = await supabase.from("pharmacy_groups").select("*").eq("id", id).maybeSingle(); if (!group) notFound(); return <div className="space-y-6"><h1 className="text-2xl font-semibold tracking-tight">Modifier {group.name}</h1><Card><CardHeader><CardTitle>Groupement</CardTitle></CardHeader><CardContent><GroupEditForm group={group} /></CardContent></Card></div>; }
