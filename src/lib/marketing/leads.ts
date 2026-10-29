import { z } from "zod";

export const leadStatuses = ["new", "contacted", "qualified", "pilot_proposed", "pilot_active", "won", "lost", "archived"] as const;
export type LeadStatus = (typeof leadStatuses)[number];

export const leadCaptureSchema = z.object({
  leadAudience: z.enum(["brand", "pharmacy"]).default("brand"),
  fullName: z.string().trim().min(2, "Indiquez votre nom complet.").max(120),
  professionalEmail: z.email("Utilisez une adresse e-mail valide.").max(254),
  companyName: z.string().trim().min(2, "Indiquez votre marque ou laboratoire.").max(160),
  website: z.string().max(0).optional(),
  websiteUrl: z.union([
    z.url("Indiquez une adresse de site valide.").max(500).refine((value) => /^https?:\/\//i.test(value), "Utilisez une adresse http:// ou https://."),
    z.literal(""),
  ]).optional(),
  location: z.string().trim().max(120).optional(),
  need: z.string().trim().max(2000, "Votre message doit contenir au maximum 2 000 caractères.").optional(),
}).superRefine((input, context) => {
  if (input.leadAudience === "pharmacy" && (!input.location || input.location.length < 2)) {
    context.addIssue({ code: "custom", path: ["location"], message: "Indiquez la ville ou le code postal de votre pharmacie." });
  }
});

export function formatLeadRequest(input: z.output<typeof leadCaptureSchema>) {
  return [
    input.websiteUrl ? `Site web : ${input.websiteUrl}` : "",
    input.location ? `Ville ou code postal : ${input.location}` : "",
    input.need ? `Besoin exprimé : ${input.need}` : "",
  ].filter(Boolean).join("\n");
}

export function normalizeLeadInput(input: z.input<typeof leadCaptureSchema>) {
  const parsed = leadCaptureSchema.parse(input);
  return {
    fullName: parsed.fullName.replace(/\s+/g, " "),
    professionalEmail: parsed.professionalEmail.trim().toLowerCase(),
    companyName: parsed.companyName.replace(/\s+/g, " "),
  };
}

export function leadDeduplicationScope(professionalEmail: string, companyName: string, day: string) {
  return `${professionalEmail.trim().toLowerCase()}:${companyName.trim().toLowerCase()}:${day}`;
}

const allowedTransitions: Record<LeadStatus, LeadStatus[]> = {
  new: ["contacted", "qualified", "lost", "archived"],
  contacted: ["qualified", "lost", "archived"],
  qualified: ["pilot_proposed", "won", "lost", "archived"],
  pilot_proposed: ["pilot_active", "lost", "archived"],
  pilot_active: ["won", "lost", "archived"],
  won: ["archived"],
  lost: ["archived"],
  archived: [],
};

export function canTransitionLead(from: LeadStatus, to: LeadStatus) {
  return from === to || allowedTransitions[from].includes(to);
}

export const pilotPreparationSchema = z.object({
  leadId: z.uuid(),
  proposedOrganizationName: z.string().trim().min(2).max(160),
  proposedBrandName: z.string().trim().min(2).max(120),
  countryOrScope: z.union([z.string().trim().length(2).transform((value) => value.toUpperCase()), z.literal("")]),
  estimatedUsers: z.union([z.coerce.number().int().min(1).max(10000), z.literal("")]),
  proposedStartDate: z.string().optional(),
  confirmation: z.literal("true"),
});
