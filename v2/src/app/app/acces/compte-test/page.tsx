import Link from "next/link";
import { requireOwner } from "@/lib/auth";
import { PharmacyTestSetupForm } from "./form";

export default async function PharmacyPilotTestAccountPage() {
  const { db } = await requireOwner();
  const { data: membership, error } = await db.from("pharmacy_memberships")
    .select("user_id,active")
    .eq("pharmacy_id","33a4d857-98b0-412b-9f22-f6c8cd3ab623")
    .eq("active",true).limit(1);
  if(error) throw new Error("Impossible de vérifier le rattachement du compte test.");
  return <div className="space-y-7">
    <Link href="/app/pilote" className="text-sm font-semibold underline">← Retour au pilote VK SWISS</Link>
    <div>
      <p className="text-xs font-bold uppercase tracking-widest text-[#ad4b08]">Supabase V2 · Compte test</p>
      <h1 className="mt-2 text-3xl font-bold">Compte pharmacie — Plein Sud</h1>
      <p className="mt-2 text-sm text-[#69717d]">
        Ce compte test est distinct de ton compte administrateur.
        Seule l’adresse indiquée ci-dessous est autorisée dans ce parcours de création.
      </p>
    </div>
    {membership?.length ?
      <p className="rounded-xl border border-green-200 bg-green-50 p-5 text-sm font-semibold text-green-800">
        Un compte pharmacie est déjà rattaché à Plein Sud. Ne crée pas un doublon.
        <Link href="/app/acces" className="ml-2 underline">Gérer l’accès B2B</Link>
      </p>
      : <PharmacyTestSetupForm/>}
    <p className="text-sm text-[#69717d]">
      Si la création automatique est désactivée dans Supabase Auth, utilise le
      <Link href="https://supabase.com/dashboard/project/evkvbjnftffstcqxgard/auth/users"
        className="mx-1 font-semibold underline" target="_blank">tableau Supabase V2</Link>
      pour créer manuellement l’utilisateur, puis clique sur « Finaliser le rattachement ».
    </p>
  </div>;
}
