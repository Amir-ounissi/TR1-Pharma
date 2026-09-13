"use client";

import { useActionState, useEffect, useRef } from "react";
import Link from "next/link";
import { captureLeadAction, type LeadCaptureState } from "@/app/(public)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trackMarketingEvent } from "@/lib/marketing/analytics";

const initialState: LeadCaptureState = {};

export function LeadForm() {
  const [state, action, pending] = useActionState(captureLeadAction, initialState);
  const started = useRef(false);

  useEffect(() => {
    if (state.error) trackMarketingEvent("lead_form_validation_error");
  }, [state.error]);

  const start = () => {
    if (!started.current) {
      started.current = true;
      trackMarketingEvent("lead_form_start");
    }
  };

  return (
    <form
      action={action}
      className="grid gap-4 rounded-[1.2rem] border border-[#d8d0c2] bg-[#fffaf0] p-5 shadow-[0_24px_70px_rgba(15,39,64,.08)] sm:p-7"
      id="diagnostic-form"
      onFocus={start}
    >
      <div>
        <p className="font-mono text-[.65rem] font-bold uppercase tracking-[.18em] text-[#c9562d]">Démonstration personnalisée</p>
        <h2 className="mt-2 text-2xl font-black tracking-[-.04em] text-[#0f2740]">Parlons de votre organisation terrain.</h2>
        <p className="mt-2 text-sm leading-6 text-[#596574]">Trois informations suffisent pour préparer un échange adapté à votre réseau.</p>
      </div>

      {state.error ? (
        <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">{state.error}</p>
      ) : null}

      <div className="grid gap-2">
        <Label htmlFor="fullName">Nom et prénom</Label>
        <Input autoComplete="name" defaultValue={state.fields?.fullName} id="fullName" maxLength={120} name="fullName" required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="professionalEmail">Email professionnel</Label>
        <Input autoComplete="email" defaultValue={state.fields?.professionalEmail} id="professionalEmail" maxLength={254} name="professionalEmail" required type="email" />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="companyName">Marque ou laboratoire</Label>
        <Input autoComplete="organization" defaultValue={state.fields?.companyName} id="companyName" maxLength={160} name="companyName" required />
      </div>

      <div aria-hidden="true" className="absolute -left-[10000px]">
        <Label htmlFor="website">Site web</Label>
        <Input autoComplete="off" id="website" name="website" tabIndex={-1} />
      </div>

      <Button
        className="h-12 bg-[#0f2740] font-mono text-xs font-black uppercase tracking-[.08em] text-white hover:bg-[#173a5c]"
        disabled={pending}
        onClick={() => trackMarketingEvent("lead_form_submit")}
        type="submit"
      >
        {pending ? "Envoi…" : "Demander une démo"}
      </Button>

      <p className="text-sm font-semibold text-[#596574]">Nous vous recontacterons pour convenir d’un créneau.</p>
      <p className="text-xs leading-5 text-[#66717d]">
        Vos informations sont utilisées uniquement pour répondre à votre demande. <Link className="underline" href="/politique-de-confidentialite">Politique de confidentialité</Link>.
      </p>
    </form>
  );
}
