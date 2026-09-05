import { z } from "zod";

export const signupProfileTypes = ["brand", "agent", "facilitator"] as const;
export const facilitatorKinds = ["animateur", "formateur", "mixte"] as const;
export const facilitatorActivities = ["animation", "training"] as const;

export const signupProfileTypeSchema = z.enum(signupProfileTypes);
const facilitatorActivitySchema = z.enum(facilitatorActivities);

export type SignupProfileType = z.infer<typeof signupProfileTypeSchema>;
export type FacilitatorKind = (typeof facilitatorKinds)[number];
export type FacilitatorActivity = (typeof facilitatorActivities)[number];

export const signupIntentSchema = z.object({
  fullName: z.string().trim().min(2, "Le nom complet est requis.").max(120),
  email: z.email("Email invalide."),
  password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères.").max(72),
  confirmPassword: z.string().min(8).max(72),
  profileType: signupProfileTypeSchema,
  companyName: z.string().trim().max(120).optional(),
  jobTitle: z.string().trim().max(120).optional(),
  currentOrganization: z.string().trim().max(120).optional(),
  territory: z.string().trim().max(120).optional(),
  facilitatorActivities: z.array(facilitatorActivitySchema).max(2).optional(),
  facilitatorKind: z.enum(facilitatorKinds).optional(),
  specialty: z.string().trim().max(120).optional(),
}).superRefine((data, ctx) => {
  if (data.password !== data.confirmPassword) {
    ctx.addIssue({
      code: "custom",
      path: ["confirmPassword"],
      message: "Les mots de passe ne correspondent pas.",
    });
  }

  if (data.profileType === "brand") {
    if (!data.companyName || data.companyName.length < 2) {
      ctx.addIssue({
        code: "custom",
        path: ["companyName"],
        message: "Le nom de la marque ou société est requis.",
      });
    }

    if (!data.jobTitle || data.jobTitle.length < 2) {
      ctx.addIssue({
        code: "custom",
        path: ["jobTitle"],
        message: "Votre fonction est requise.",
      });
    }
  }

  if (data.profileType === "agent") {
    if (!data.currentOrganization || data.currentOrganization.length < 2) {
      ctx.addIssue({
        code: "custom",
        path: ["currentOrganization"],
        message: "Votre structure actuelle est requise.",
      });
    }

    if (!data.territory || data.territory.length < 2) {
      ctx.addIssue({
        code: "custom",
        path: ["territory"],
        message: "Votre zone ou secteur est requis.",
      });
    }
  }

  if (data.profileType === "facilitator") {
    const activities = resolveFacilitatorActivities(
      data.facilitatorActivities,
      data.facilitatorKind,
    );

    if (activities.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["facilitatorActivities"],
        message: "Sélectionnez au moins une activité : Animation ou Formation.",
      });
    }
  }
});

export type SignupIntent = z.infer<typeof signupIntentSchema>;

export function buildSignupMetadata(intent: SignupIntent) {
  const requestedAccess =
    intent.profileType === "brand"
      ? {
          type: intent.profileType,
          company_name: intent.companyName,
          job_title: intent.jobTitle,
        }
      : intent.profileType === "agent"
        ? {
            type: intent.profileType,
            organization: intent.currentOrganization,
            territory: intent.territory,
          }
        : buildFacilitatorRequestedAccess(intent);

  return {
    full_name: intent.fullName,
    requested_profile_type: intent.profileType,
    requested_access: requestedAccess,
  };
}

export function getSignupSuccessMessage(profileType: SignupProfileType) {
  return profileType === "brand"
    ? "Compte créé. Vérifiez votre email puis attendez la validation de votre accès marque par TR1."
    : profileType === "agent"
      ? "Compte créé. Vérifiez votre email puis attendez votre rattachement à une marque et à vos pharmacies."
      : "Compte créé. Vérifiez votre email puis attendez la validation de votre accès intervenant et de vos activités.";
}

function buildFacilitatorRequestedAccess(intent: SignupIntent) {
  const activities = resolveFacilitatorActivities(
    intent.facilitatorActivities,
    intent.facilitatorKind,
  );

  return {
    type: "facilitator" as const,
    activities,
    facilitator_kind: facilitatorKindFromActivities(activities),
    ...(intent.specialty ? { specialty: intent.specialty } : {}),
  };
}

function resolveFacilitatorActivities(
  activities: readonly FacilitatorActivity[] | undefined,
  legacyKind: FacilitatorKind | undefined,
): FacilitatorActivity[] {
  if (activities?.length) {
    return [...new Set(activities)].sort() as FacilitatorActivity[];
  }

  if (legacyKind === "animateur") return ["animation"];
  if (legacyKind === "formateur") return ["training"];
  if (legacyKind === "mixte") return ["animation", "training"];
  return [];
}

function facilitatorKindFromActivities(
  activities: readonly FacilitatorActivity[],
): FacilitatorKind | undefined {
  if (activities.length === 2) return "mixte";
  if (activities[0] === "animation") return "animateur";
  if (activities[0] === "training") return "formateur";
  return undefined;
}
