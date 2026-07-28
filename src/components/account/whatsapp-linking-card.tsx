"use client";

import { useState, useTransition } from "react";
import { MessageCircle, Unlink } from "lucide-react";
import { revokeWhatsAppAction, startWhatsAppLinkAction } from "@/app/(protected)/dashboard/account/whatsapp/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Channel = { id: string; normalized_identifier: string; verified_at: string; revoked_at: string | null } | null;

function maskPhone(value: string) {
  return `•• •• •• ${value.slice(-4, -2)} ${value.slice(-2)}`;
}

export function WhatsAppLinkingCard({ channel }: { channel: Channel }) {
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <Card className="border-[#d9d0bf] bg-[#fffdf7]">
      <CardHeader><div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-full bg-[#e7f3ed] text-[#176b45]"><MessageCircle className="size-5" /></span><div><CardTitle>WhatsApp</CardTitle><p className="text-sm text-muted-foreground">{channel ? "Connecté" : "Non connecté"}</p></div></div></CardHeader>
      <CardContent className="space-y-4">
        {channel ? (
          <>
            <div className="rounded-xl border bg-background p-4"><p className="font-semibold">{maskPhone(channel.normalized_identifier)}</p><p className="text-sm text-muted-foreground">Depuis le {new Intl.DateTimeFormat("fr-FR").format(new Date(channel.verified_at))}</p></div>
            <Button variant="outline" disabled={pending} onClick={() => startTransition(async () => { const result = await revokeWhatsAppAction(channel.id); if (result.error) setError(result.error); else location.reload(); })}><Unlink className="size-4" />Déconnecter</Button>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">Générez un code valable 10 minutes, puis envoyez-le au numéro WhatsApp TR1 Pharma.</p>
            <Button disabled={pending} onClick={() => startTransition(async () => { const result = await startWhatsAppLinkAction(); setError(result.error ?? null); setCode(result.code ?? null); })}>Générer un code</Button>
            {code && <div data-testid="whatsapp-link-code" className="rounded-xl border border-[#ee8f45]/50 bg-[#fff3df] p-5 text-center"><p className="text-xs uppercase tracking-widest text-muted-foreground">Code de liaison</p><p className="mt-2 font-mono text-2xl font-bold text-[#0f2740]">{code}</p><p className="mt-2 text-xs text-muted-foreground">Usage unique · expiration dans 10 minutes</p></div>}
          </>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}

