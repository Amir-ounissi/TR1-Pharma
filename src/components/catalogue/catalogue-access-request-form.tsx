"use client";

import { useActionState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  requestCatalogueAccessAction,
  type CatalogueAccessRequestState,
} from "@/app/catalogue/access-request-actions";

const initialState: CatalogueAccessRequestState = {};

export function CatalogueAccessRequestForm() {
  const [state, action, pending] = useActionState(requestCatalogueAccessAction, initialState);
  const errorSummary = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (state.error) errorSummary.current?.focus();
  }, [state]);

  return (
    <form action={action} aria-busy={pending} className="shop-card grid gap-7 p-5 sm:p-8">
      {state.error ? (
        <p ref={errorSummary} tabIndex={-1} role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-sm leading-6 text-red-900">
          {state.error}
        </p>
      ) : null}

      <fieldset className="grid gap-4">
        <legend className="mb-1 text-lg font-black text-[#0e1d31]">1. Votre officine</legend>
        <TextField id="pharmacyName" label="Nom commercial de la pharmacie" autoComplete="organization" maxLength={160} defaultValue={state.fields?.pharmacyName} error={state.fieldErrors?.pharmacyName} />
        <TextField id="addressLine" label="Adresse complète" autoComplete="street-address" maxLength={180} defaultValue={state.fields?.addressLine} error={state.fieldErrors?.addressLine} />
        <div className="grid gap-4 sm:grid-cols-[150px_1fr]">
          <TextField id="postalCode" label="Code postal" autoComplete="postal-code" inputMode="numeric" maxLength={5} defaultValue={state.fields?.postalCode} error={state.fieldErrors?.postalCode} />
          <TextField id="city" label="Ville" autoComplete="address-level2" maxLength={80} defaultValue={state.fields?.city} error={state.fieldErrors?.city} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField id="siret" label="SIRET (14 chiffres)" inputMode="numeric" maxLength={14} required={false} defaultValue={state.fields?.siret} error={state.fieldErrors?.siret} />
          <TextField id="finess" label="FINESS (9 chiffres)" inputMode="numeric" maxLength={9} required={false} defaultValue={state.fields?.finess} error={state.fieldErrors?.finess} />
        </div>
        <p className="text-xs leading-5 text-[#69717d]">Au moins un identifiant est obligatoire. Les informations seront contrôlées avant toute ouverture d’accès.</p>
      </fieldset>

      <fieldset className="grid gap-4 border-t border-[#e2e7ec] pt-6">
        <legend className="mb-1 text-lg font-black text-[#0e1d31]">2. Votre contact professionnel</legend>
        <TextField id="fullName" label="Nom et prénom" autoComplete="name" maxLength={120} defaultValue={state.fields?.fullName} error={state.fieldErrors?.fullName} />
        <SelectField id="role" label="Votre fonction dans l’officine" defaultValue={state.fields?.role} error={state.fieldErrors?.role} />
        <TextField id="professionalEmail" label="Adresse e-mail professionnelle" type="email" autoComplete="email" maxLength={254} defaultValue={state.fields?.professionalEmail} error={state.fieldErrors?.professionalEmail} />
        <TextField id="phone" label="Téléphone professionnel" type="tel" autoComplete="tel" inputMode="tel" maxLength={24} placeholder="06 12 34 56 78" defaultValue={state.fields?.phone} error={state.fieldErrors?.phone} />
      </fieldset>

      <fieldset className="grid gap-4 border-t border-[#e2e7ec] pt-6">
        <legend className="mb-2 text-lg font-black text-[#0e1d31]">3. Vérification et confidentialité</legend>
        <CheckboxField
          name="pharmacyConfirmation"
          error={state.fieldErrors?.pharmacyConfirmation}
          defaultChecked={state.fields?.pharmacyConfirmation === "true"}
        >
          Je certifie que cette demande concerne une pharmacie d’officine en activité et que je suis autorisé(e) à la représenter.
        </CheckboxField>
        <CheckboxField
          name="privacyAcknowledged"
          error={state.fieldErrors?.privacyAcknowledged}
          defaultChecked={state.fields?.privacyAcknowledged === "true"}
        >
          J’ai pris connaissance de la <Link className="font-bold underline underline-offset-2" href="/politique-de-confidentialite">politique de confidentialité</Link> et comprends que mes informations seront utilisées pour vérifier et traiter cette demande.
        </CheckboxField>
      </fieldset>

      <div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden">
        <label htmlFor="catalogue-access-website">Ne pas remplir</label>
        <input id="catalogue-access-website" name="website" type="text" autoComplete="off" tabIndex={-1} />
      </div>

      <div className="grid gap-3 border-t border-[#e2e7ec] pt-6">
        <button type="submit" disabled={pending} className="shop-primary-action min-h-12 w-full px-5 py-3 text-sm">
          {pending ? "Transmission en cours…" : "Envoyer ma demande d’accès"}
        </button>
        <p className="text-center text-xs leading-5 text-[#69717d]">L’envoi de ce formulaire ne crée pas automatiquement un compte et ne donne pas immédiatement accès aux tarifs.</p>
      </div>
    </form>
  );
}

function TextField({
  id,
  label,
  error,
  required = true,
  ...props
}: {
  id: string;
  label: string;
  error?: string;
} & Omit<React.ComponentProps<"input">, "id">) {
  const errorId = id + "-error";
  return (
    <div className="grid min-w-0 gap-2">
      <label htmlFor={id} className="text-sm font-bold text-[#0e1d31]">
        {label} {required ? <span aria-hidden="true" className="text-[#ad4b08]">*</span> : <span className="font-normal text-[#69717d]">(facultatif si l’autre identifiant est renseigné)</span>}
      </label>
      <input
        {...props}
        id={id}
        name={id}
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        className="h-12 w-full min-w-0 rounded-md border border-[#cbd3dc] bg-white px-3 text-base text-[#0e1d31] outline-offset-2 placeholder:text-[#8b929b]"
      />
      {error ? <p id={errorId} className="text-sm text-red-800">{error}</p> : null}
    </div>
  );
}

function SelectField({
  id,
  label,
  defaultValue,
  error,
}: {
  id: string;
  label: string;
  defaultValue?: string;
  error?: string;
}) {
  const errorId = id + "-error";
  return (
    <div className="grid gap-2">
      <label htmlFor={id} className="text-sm font-bold text-[#0e1d31]">{label} <span aria-hidden="true" className="text-[#ad4b08]">*</span></label>
      <select
        id={id}
        name={id}
        required
        defaultValue={defaultValue ?? ""}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        className="h-12 w-full rounded-md border border-[#cbd3dc] bg-white px-3 text-base text-[#0e1d31]"
      >
        <option value="" disabled>Choisir votre fonction</option>
        <option value="titulaire">Pharmacien titulaire</option>
        <option value="adjoint">Pharmacien adjoint</option>
        <option value="preparateur">Préparateur / préparatrice</option>
        <option value="responsable_achats">Responsable des achats</option>
        <option value="autre">Autre membre de l’équipe</option>
      </select>
      {error ? <p id={errorId} className="text-sm text-red-800">{error}</p> : null}
    </div>
  );
}

function CheckboxField({
  name,
  error,
  defaultChecked,
  children,
}: {
  name: string;
  error?: string;
  defaultChecked?: boolean;
  children: React.ReactNode;
}) {
  const errorId = name + "-error";
  return (
    <div className="grid gap-2">
      <label className="flex items-start gap-3 text-sm leading-6 text-[#394657]">
        <input
          name={name}
          type="checkbox"
          value="true"
          required
          defaultChecked={defaultChecked}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          className="mt-1 size-4 shrink-0 accent-[#ea7015]"
        />
        <span>{children}</span>
      </label>
      {error ? <p id={errorId} className="text-sm text-red-800">{error}</p> : null}
    </div>
  );
}
