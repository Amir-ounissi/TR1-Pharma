export const LEGAL_PLACEHOLDER = "À renseigner avant exposition publique";

const legalEnvironmentFields = {
  legalEntityName: "LEGAL_ENTITY_NAME",
  legalForm: "LEGAL_FORM",
  shareCapital: "LEGAL_SHARE_CAPITAL",
  registeredOffice: "LEGAL_REGISTERED_OFFICE",
  registrationNumber: "LEGAL_REGISTRATION_NUMBER",
  vatNumber: "LEGAL_VAT_NUMBER",
  publicationDirector: "LEGAL_PUBLICATION_DIRECTOR",
  contactEmail: "LEGAL_CONTACT_EMAIL",
  privacyContactEmail: "PRIVACY_CONTACT_EMAIL",
  dataController: "PRIVACY_DATA_CONTROLLER",
  hostingProviderName: "LEGAL_HOSTING_PROVIDER_NAME",
  hostingProviderAddress: "LEGAL_HOSTING_PROVIDER_ADDRESS",
  leadRetentionDuration: "PRIVACY_LEAD_RETENTION_DURATION",
  legalBasis: "PRIVACY_LEGAL_BASIS",
  privacyPolicyUpdatedAt: "PRIVACY_POLICY_UPDATED_AT",
} as const;

export type LegalInformation = Record<keyof typeof legalEnvironmentFields, string>;

// Verified company identifiers come from the TR1 Pharma Kbis (22 October 2026)
// and the company's issued invoice dated 18 November 2026.
// Public infrastructure providers and their published legal addresses are listed
// in their current terms and data-processing addenda.
const legalDefaults:LegalInformation = {
  legalEntityName:"TR1 Pharma",
  legalForm:"EURL — SARL à associé unique",
  shareCapital:"500 €",
  registeredOffice:"17 Route de la Capelette, 13800 Istres, France",
  registrationNumber:"SIREN 131 791 238 · SIRET 131 791 238 00010 · RCS Salon-de-Provence 131 791 238",
  vatNumber:"FR77131791238",
  publicationDirector:"Amir Nasser-Dine Houcine OUNISSI, gérant",
  contactEmail:"contact@tr1pharma.com",
  privacyContactEmail:"contact@tr1pharma.com",
  dataController:"TR1 Pharma, représentée par son gérant Amir Nasser-Dine Houcine OUNISSI",
  hostingProviderName:"Vercel Inc. (application) · Supabase Pte. Ltd. (base de données et authentification)",
  hostingProviderAddress:"Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis · Supabase Pte. Ltd., 65 Chulia Street #38-02/03, OCBC Centre, Singapore 049513",
  leadRetentionDuration:"3 ans à compter du dernier contact actif avec le prospect, sauf obligation légale ou contentieux justifiant une durée différente.",
  legalBasis:"Intérêt légitime de TR1 Pharma à traiter les demandes professionnelles et assurer le suivi commercial B2B ; mesures précontractuelles prises à la demande de l'officine lorsqu'elle sollicite une proposition de référencement ou de commande.",
  privacyPolicyUpdatedAt:"27 novembre 2026",
};

type ApplicationEnvironment = "local" | "test" | "staging" | "production";

function readApplicationEnvironment(environment: Record<string, string | undefined>): ApplicationEnvironment {
  const value = environment.APP_ENV ?? (environment.NODE_ENV === "test" ? "test" : "local");
  if (!["local", "test", "staging", "production"].includes(value)) throw new Error(`APP_ENV invalide : ${value}`);
  return value as ApplicationEnvironment;
}

export function readLegalConfiguration(environment: Record<string, string | undefined> = process.env) {
  const information = Object.fromEntries(
    Object.entries(legalEnvironmentFields).map(([key, variable]) => [
      key,
      environment[variable]?.trim() || legalDefaults[key as keyof LegalInformation] || LEGAL_PLACEHOLDER,
    ])
  ) as LegalInformation;
  const missingFields = Object.entries(information)
    .filter(([, value]) => value === LEGAL_PLACEHOLDER)
    .map(([key]) => key as keyof LegalInformation);
  return { appEnvironment: readApplicationEnvironment(environment), information, missingFields };
}

export function validateLegalConfiguration(environment: Record<string, string | undefined> = process.env, warn: (message: string) => void = console.warn) {
  const configuration = readLegalConfiguration(environment);
  if (!configuration.missingFields.length) return configuration;
  const message = `Informations légales manquantes : ${configuration.missingFields.join(", ")}`;
  if (configuration.appEnvironment !== "test") warn(`${message}. Placeholders temporaires autorisés en ${configuration.appEnvironment}; compléter avant publication juridique définitive.`);
  return configuration;
}

const legalConfiguration = validateLegalConfiguration();

export const legalInformation = legalConfiguration.information;
export const missingLegalInformation = legalConfiguration.missingFields;
