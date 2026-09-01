import { z } from "zod";

export const leadStatuses = ["new", "contacted", "qualified", "pilot_proposed", "pilot_active", "won", "lost", "archived"] as const;
export type LeadStatus = (typeof leadStatuses)[number];

export const leadCaptureSchema = z.object({
  fullName: z.string().trim().min(2, "Indiquez votre nom complet.").max(120),
  professionalEmail: z.email("Utilisez une adresse e-mail valide.").max(254),
  companyName: z.string().trim().min(2, "Indiquez votre marque ou laboratoire.").max(160),
  website: z.string().max(0).optional(),
});

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
