import { WhatsAppLinkingCard } from "@/components/account/whatsapp-linking-card";
import { requireActiveBrand } from "@/lib/auth";

export default async function WhatsAppAccountPage() {
  const { supabase } = await requireActiveBrand();
  const { data } = await supabase.from("communication_channels")
    .select("id,normalized_identifier,verified_at,revoked_at")
    .eq("channel_type", "whatsapp")
    .is("revoked_at", null)
    .maybeSingle();
  return (
    <main className="mx-auto max-w-3xl space-y-5">
      <header className="rounded-3xl bg-[#0f2740] px-6 py-6 text-[#fffaf0]">
        <p className="text-xs font-semibold uppercase tracking-[.2em] text-[#7fb8df]">Mon compte</p>
        <h1 className="mt-2 text-3xl font-semibold">Connecter WhatsApp</h1>
        <p className="mt-2 text-sm text-[#d7e2eb]">Associez votre numéro sans exposer vos données terrain.</p>
      </header>
      <WhatsAppLinkingCard channel={data} />
    </main>
  );
}

