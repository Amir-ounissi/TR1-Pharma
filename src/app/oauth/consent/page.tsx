import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getChatGptMcpConfig } from "@/lib/connectors/chatgpt-mcp-config";
import { oauthConsentReturn } from "@/lib/connectors/chatgpt-oauth-return";
import { decideTr1OAuthConsent } from "./actions";

type SearchParams = Promise<{ authorization_id?: string }>;

export default async function OAuthConsentPage({ searchParams }: { searchParams: SearchParams }) {
  if (!getChatGptMcpConfig()) notFound();

  const { authorization_id: authorizationId } = await searchParams;
  const returnTo = oauthConsentReturn(
    authorizationId ? "/oauth/consent?authorization_id=" + encodeURIComponent(authorizationId) : null,
  );
  if (!returnTo || !authorizationId) notFound();

  const supabase = await createClient();
  const { data: session, error: sessionError } = await supabase.auth.getClaims();
  if (sessionError || !session?.claims?.sub) {
    redirect("/login?returnTo=" + encodeURIComponent(returnTo));
  }

  const { data: details, error } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId);
  if (error || !details) {
    return <main className="mx-auto max-w-lg px-5 py-20">
      <h1 className="text-2xl font-bold">Autorisation indisponible</h1>
      <p className="mt-3">Cette demande est invalide ou a expiré. Relancez la connexion depuis ChatGPT.</p>
    </main>;
  }
  if (!("authorization_id" in details)) redirect(details.redirect_url);

  const client = details.client as unknown as Record<string, unknown>;
  const clientId = client.client_id ?? client.id;
  const config = getChatGptMcpConfig();
  if (typeof clientId !== "string" || !config?.allowedClientIds.includes(clientId)) {
    return <main className="mx-auto max-w-lg px-5 py-20">
      <h1 className="text-2xl font-bold">Client non autorisé</h1>
      <p className="mt-3">Cette application n'est pas autorisée à se connecter à TR1.</p>
    </main>;
  }

  return (
    <main className="mx-auto max-w-xl px-5 py-16 text-[#0b1e32]">
      <section className="rounded-2xl border border-[#d8d0c2] bg-white p-7 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wider text-[#c84f24]">TR1 PHARMA · Connexion sécurisée</p>
        <h1 className="mt-4 text-2xl font-bold">Autoriser l'accès à TR1 ?</h1>
        <p className="mt-4">
          <strong>{details.client.name}</strong> souhaite accéder à vos données TR1 pour rechercher
          des pharmacies dans les marques auxquelles vous avez accès.
        </p>
        <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm">
          Fonction proposée par ce connecteur : rechercher des pharmacies. Les permissions OAuth sous-jacentes devront être restreintes et validées avant activation.
        </p>
        <dl className="mt-5 space-y-2 text-sm">
          <div><dt className="font-semibold">Application</dt><dd>{details.client.name}</dd></div>
          <div><dt className="font-semibold">Adresse de retour</dt><dd className="break-all">{details.redirect_uri}</dd></div>
          <div><dt className="font-semibold">Permissions OAuth demandées</dt><dd>{details.scope || "email"}</dd></div>
        </dl>
        <form action={decideTr1OAuthConsent} className="mt-7 flex flex-wrap gap-3">
          <input type="hidden" name="authorization_id" value={authorizationId} />
          <button name="decision" value="approve" className="rounded-xl bg-[#0b1e32] px-5 py-3 font-bold text-white">Autoriser</button>
          <button name="decision" value="deny" className="rounded-xl border border-[#d8d0c2] px-5 py-3 font-bold">Refuser</button>
        </form>
        <p className="mt-5 text-xs text-[#667384]">
          Vos identifiants TR1 ne sont pas transmis à ChatGPT. Vous pourrez révoquer cette autorisation depuis votre compte.
        </p>
      </section>
    </main>
  );
}
