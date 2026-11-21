import { z } from "zod";

export const catalogueAccessRoles = [
  "titulaire",
  "adjoint",
  "preparateur",
  "responsable_achats",
  "autre",
] as const;

export const catalogueAccessRoleLabels: Record<(typeof catalogueAccessRoles)[number], string> = {
  titulaire: "Pharmacien titulaire",
  adjoint: "Pharmacien adjoint",
  preparateur: "Préparateur / préparatrice",
  responsable_achats: "Responsable des achats",
  autre: "Autre membre de l’équipe",
};

export function isValidSiret(value: string) {
  if (!/^\d{14}$/.test(value)) return false;
  let sum = 0;
  for (let index = 0; index < value.length; index += 1) {
    let digit = Number(value[index]);
    if ((value.length - 1 - index) % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
}

export const catalogueAccessRequestSchema = z.object({
  interest: z.string().trim().max(200, "Limitez votre sélection à 200 caractères.").optional().default(""),
  fullName: z.string().trim().min(2, "Indiquez votre nom et prénom.").max(120),
  role: z.enum(catalogueAccessRoles, { error: "Sélectionnez votre fonction." }),
  professionalEmail: z.email("Indiquez une adresse e-mail valide.").max(254),
  phone: z.string().trim().min(10, "Indiquez un numéro de téléphone français valide.").max(24).regex(
    /^(?:(?:\+|00)\s?33\s?|0)[1-9](?:[\s.-]?\d{2}){4}$/,
    "Indiquez un numéro de téléphone français valide.",
  ),
  pharmacyName: z.string().trim().min(2, "Indiquez le nom de l’officine.").max(160),
  addressLine: z.string().trim().min(5, "Indiquez l’adresse de l’officine.").max(180),
  postalCode: z.string().trim().regex(/^\d{5}$/, "Indiquez un code postal à 5 chiffres."),
  city: z.string().trim().min(2, "Indiquez la commune.").max(80),
  siret: z.string().trim().max(14).optional().default(""),
  finess: z.string().trim().max(9).optional().default(""),
  pharmacyConfirmation: z.literal("true", { error: "Confirmez que vous représentez une pharmacie d’officine en activité." }),
  privacyAcknowledged: z.literal("true", { error: "Veuillez prendre connaissance de la politique de confidentialité." }),
  website: z.string().max(0).optional().default(""),
}).superRefine((input, context) => {
  if (!input.siret && !input.finess) {
    context.addIssue({
      code: "custom",
      path: ["siret"],
      message: "Renseignez au moins un identifiant : SIRET ou FINESS.",
    });
  }
  if (input.siret && !isValidSiret(input.siret)) {
    context.addIssue({
      code: "custom",
      path: ["siret"],
      message: "Le SIRET doit contenir 14 chiffres et être valide.",
    });
  }
  if (input.finess && !/^\d{9}$/.test(input.finess)) {
    context.addIssue({
      code: "custom",
      path: ["finess"],
      message: "Le numéro FINESS doit contenir 9 chiffres.",
    });
  }
});

export type CatalogueAccessRequest = z.output<typeof catalogueAccessRequestSchema>;

export function normalizeCatalogueAccessRequest(input: CatalogueAccessRequest) {
  const digits = input.phone.replace(/\D/g, "");
  const phone = digits.startsWith("0033")
    ? "0" + digits.slice(4)
    : digits.startsWith("33")
      ? "0" + digits.slice(2)
      : digits;

  return {
    ...input,
    fullName: input.fullName.replace(/\s+/g, " "),
    professionalEmail: input.professionalEmail.trim().toLowerCase(),
    pharmacyName: input.pharmacyName.replace(/\s+/g, " "),
    phone,
    interest: input.interest.replace(/\s+/g, " "),
    addressLine: input.addressLine.replace(/\s+/g, " "),
    city: input.city.replace(/\s+/g, " "),
  };
}

export function formatCatalogueAccessRequest(input: CatalogueAccessRequest, submittedOn: string) {
  return [
    "DEMANDE D’ACCÈS AU CATALOGUE PROFESSIONNEL TR1 PHARMA",
    ...(input.interest ? ["Marque ou produit souhaité : " + input.interest] : []),
    "Fonction : " + catalogueAccessRoleLabels[input.role],
    "Téléphone : " + input.phone,
    "Adresse de l’officine : " + input.addressLine + ", " + input.postalCode + " " + input.city,
    "SIRET : " + (input.siret || "Non communiqué"),
    "FINESS : " + (input.finess || "Non communiqué"),
    "Déclaration pharmacie d’officine en activité : confirmée",
    "Politique de confidentialité : consultée",
    "Date de demande : " + submittedOn,
  ].join("\n");
}
