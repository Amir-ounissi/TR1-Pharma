"use client";

import { useActionState, useEffect, useRef } from "react";
import Link from "next/link";
import { captureLeadAction, type LeadCaptureState } from "@/app/(public)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trackMarketingEvent } from "@/lib/marketing/analytics";

const initialState: LeadCaptureState = {};

export function LeadForm({ audience = "brand" }: { audience?: "brand" | "pharmacy" }) {
  const [state, action, pending] = useActionState(captureLeadAction, initialState);
  const started = useRef(false);
  const errorSummary = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (state.error) {
      trackMarketingEvent("lead_form_validation_error");
      errorSummary.current?.focus();
    }
  }, [state]);

  const start = () => {
    if (!started.current) {
      started.current = true;
      trackMarketingEvent("lead_form_start");
    }
  };

  return (
    <form action={action} aria-busy={pending} className="grid gap-5" onFocus={start}>
      <input name="leadAudience" type="hidden" value={audience} />
      {state.error ? <p ref={errorSummary} tabIndex={-1} className="rounded border border-red-300 bg-red-50 p-3 text-sm leading-6 text-red-900 focus:outline-2 focus:outline-offset-2" role="alert">{state.error}</p> : null}
      <Field autoComplete="name" defaultValue={state.fields?.fullName} error={state.fieldErrors?.fullName} id={`${audience}-fullName`} label="Nom et prénom" maxLength={120} name="fullName" />
      <Field autoComplete="email" defaultValue={state.fields?.professionalEmail} error={state.fieldErrors?.professionalEmail} id={`${audience}-professionalEmail`} label="Email professionnel" maxLength={254} name="professionalEmail" type="email" />
      <Field autoComplete="organization" defaultValue={state.fields?.companyName} error={state.fieldErrors?.companyName} id={`${audience}-companyName`} label={audience === "pharmacy" ? "Nom de la pharmacie" : "Marque ou laboratoire"} maxLength={160} name="companyName" />
      {audience === "brand" ? (
        <Field autoComplete="url" defaultValue={state.fields?.websiteUrl} error={state.fieldErrors?.websiteUrl} id={`${audience}-websiteUrl`} label="Site web" maxLength={500} name="websiteUrl" type="url" placeholder="https://" required={false} />
      ) : (
        <Field autoComplete="address-level2" defaultValue={state.fields?.location} error={state.fieldErrors?.location} id={`${audience}-location`} label="Ville ou code postal" maxLength={120} name="location" />
      )}
      <div className="grid gap-2">
        <Label htmlFor={`${audience}-need`}>Votre besoin <span className="font-normal text-[#515d6b]">(facultatif)</span></Label>
        <textarea aria-describedby={state.fieldErrors?.need ? `${audience}-need-error` : undefined} aria-invalid={Boolean(state.fieldErrors?.need)} className="min-h-28 w-full resize-y rounded-md border border-[#a39c90] bg-white p-3 text-base leading-6 text-[#0e1d31] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0e1d31]" defaultValue={state.fields?.need} id={`${audience}-need`} maxLength={2000} name="need" rows={3} />
        {state.fieldErrors?.need ? <p className="text-sm text-red-800" id={`${audience}-need-error`}>{state.fieldErrors.need}</p> : null}
      </div>
      <div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden">
        <Label htmlFor={`${audience}-website`}>Laisser ce champ vide</Label>
        <Input autoComplete="off" id={`${audience}-website`} name="website" tabIndex={-1} />
      </div>
      <Button aria-describedby={`${audience}-submit-status`} className="h-auto min-h-12 whitespace-normal bg-[var(--tr1-orange)] px-4 py-3 text-sm font-semibold text-[#0e1d31] hover:bg-[#f28331] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#0e1d31]" disabled={pending} onClick={() => trackMarketingEvent("lead_form_submit")} type="submit">
        {pending ? "Envoi en cours…" : audience === "pharmacy" ? "Être recontacté" : "Échanger sur mon développement"}
      </Button>
      <span aria-live="polite" className="sr-only" id={`${audience}-submit-status`}>{pending ? "Votre demande est en cours d’envoi." : ""}</span>
      <p className="text-xs leading-5 text-[#515d6b]">Vos informations sont utilisées uniquement pour répondre à votre demande. <Link className="underline underline-offset-2" href="/politique-de-confidentialite">Politique de confidentialité</Link>.</p>
    </form>
  );
}

function Field({ id, label, error, required = true, ...props }: { id: string; label: string; error?: string } & React.ComponentProps<typeof Input>) {
  const errorId = `${id}-error`;
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label} {required ? <><span aria-hidden="true" className="text-[#ad4b08]">*</span><span className="sr-only"> obligatoire</span></> : <span className="font-normal text-[#515d6b]">(facultatif)</span>}</Label>
      <Input {...props} aria-describedby={error ? errorId : undefined} aria-invalid={Boolean(error)} className="h-12 border-[#a39c90] bg-white text-base text-[#0e1d31] placeholder:text-[#69717d] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0e1d31] md:text-base" id={id} required={required} />
      {error ? <p className="text-sm text-red-800" id={errorId}>{error}</p> : null}
    </div>
  );
}
