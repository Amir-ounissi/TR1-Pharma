"use server";

import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getChatGptMcpConfig } from "@/lib/connectors/chatgpt-mcp-config";
import { oauthConsentReturn } from "@/lib/connectors/chatgpt-oauth-return";

export async function decideTr1OAuthConsent(formData: FormData) {
  const config = getChatGptMcpConfig();
  if (!config) notFound();

  const authorizationId = formData.get("authorization_id");
  const decision = formData.get("decision");
  const returnTo = oauthConsentReturn(
    typeof authorizationId === "string"
      ? "/oauth/consent?authorization_id=" + encodeURIComponent(authorizationId)
      : null,
  );
  if (!returnTo || (decision !== "approve" && decision !== "deny")) notFound();

  const supabase = await createClient();
  const { data: session, error: identityError } = await supabase.auth.getClaims();
  if (identityError || !session?.claims?.sub) {
    redirect("/login?returnTo=" + encodeURIComponent(returnTo));
  }

  const { data: details, error: detailsError } =
    await supabase.auth.oauth.getAuthorizationDetails(authorizationId as string);
  if (detailsError || !details) throw new Error("Demande OAuth invalide ou expirée.");
  if (!("authorization_id" in details)) {
    redirect(details.redirect_url);
  }

  // Only the deliberately registered ChatGPT OAuth client may be authorized here.
  const client = details.client as unknown as Record<string, unknown>;
  const clientId = client.client_id ?? client.id;
  if (typeof clientId !== "string" || !config.allowedClientIds.includes(clientId)) {
    throw new Error("Client OAuth non autorisé pour le connecteur TR1.");
  }

  if (decision === "approve") {
    const { data: contexts, error: contextError } = await supabase.rpc("get_my_brand_contexts");
    if (contextError || !contexts?.length) {
      throw new Error("Aucune marque TR1 autorisée pour ce compte.");
    }
  }

  const outcome = decision === "approve"
    ? await supabase.auth.oauth.approveAuthorization(authorizationId as string)
    : await supabase.auth.oauth.denyAuthorization(authorizationId as string);
  if (outcome.error || !outcome.data?.redirect_url) {
    throw new Error("Impossible de finaliser la demande d'autorisation.");
  }
  redirect(outcome.data.redirect_url);
}
