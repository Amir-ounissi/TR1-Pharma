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
    <form action={action} className="grid gap-5" id="diagnostic-form" onFocus={start}>
      {state.error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">{state.error}</p>
      ) : null}

      <Field
        autoComplete="name"
        defaultValue={state.fields?.fullName}
        error={state.fieldErrors?.fullName}
        id="fullName"
        label="Nom et prénom"
        maxLength={120}
        name="fullName"
      />
      <Field
        autoComplete="email"
        defaultValue={state.fields?.professionalEmail}
        error={state.fieldErrors?.professionalEmail}
        id="professionalEmail"
        label="Email professionnel"
        maxLength={254}
        name="professionalEmail"
        type="email"
      />
      <Field
        autoComplete="organization"
        defaultValue={state.fields?.companyName}
        error={state.fieldErrors?.companyName}
        id="companyName"
        label="Marque ou laboratoire"
        maxLength={160}
        name="companyName"
      />

      <div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden">
        <Label htmlFor="website">Site web</Label>
        <Input autoComplete="off" id="website" name="website" tabIndex={-1} />
      </div>

      <Button
        className="h-12 bg-[var(--tr1-orange)] font-mono text-xs font-black uppercase tracking-[.07em] text-white hover:brightness-95"
        disabled={pending}
        onClick={() => trackMarketingEvent("lead_form_submit")}
        type="submit"
      >
        {pending ? "Envoi…" : "Demander une démo"}
      </Button>

      <p className="text-sm font-semibold text-[var(--tr1-muted)]">Nous vous recontacterons pour convenir d’un créneau.</p>
      <p className="text-xs leading-5 text-[var(--tr1-muted)]">
        Vos informations sont utilisées uniquement pour répondre à votre demande. <Link className="underline underline-offset-2" href="/politique-de-confidentialite">Politique de confidentialité</Link>.
      </p>
    </form>
  );
}

function Field({
  id,
  label,
  error,
  ...props
}: {
  id: string;
  label: string;
  error?: string;
} & React.ComponentProps<typeof Input>) {
  const errorId = `${id}-error`;
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>
        {label} <span aria-hidden="true" className="text-[var(--tr1-orange)]">*</span><span className="sr-only"> obligatoire</span>
      </Label>
      <Input
        {...props}
        aria-describedby={error ? errorId : undefined}
        aria-invalid={Boolean(error)}
        className="h-12 bg-white text-base md:text-base"
        id={id}
        required
      />
      {error ? <p className="text-sm text-red-700" id={errorId}>{error}</p> : null}
    </div>
  );
}
