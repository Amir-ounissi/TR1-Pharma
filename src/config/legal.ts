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
type ApplicationEnvironment = "local" | "test" | "staging" | "production";
type LegalInformationStatus = "final" | "temporary";

const temporaryProductionInformation: LegalInformation = {
  legalEntityName: "TR1 Pharma — projet en phase de lancement",
  legalForm: "Structure juridique en cours de formalisation",
  shareCapital: "Information provisoire — non publiée",
  registeredOffice: "Information provisoire — adresse administrative à finaliser",
  registrationNumber: "Non attribué — en cours de formalisation",
  vatNumber: "Non attribué — en cours de formalisation",
  publicationDirector: "Direction TR1 Pharma",
  contactEmail: "Contact via le formulaire du site",
  privacyContactEmail: "Contact via le formulaire du site",
  dataController: "TR1 Pharma — équipe fondatrice",
  hostingProviderName: "Vercel Inc.",
  hostingProviderAddress: "Vercel Inc. — États-Unis",
  leadRetentionDuration: "12 mois après le dernier échange commercial, sauf obligation légale contraire",
  legalBasis: "Intérêt légitime pour les échanges B2B et mesures précontractuelles à la demande de la personne concernée",
  privacyPolicyUpdatedAt: "19 septembre 2026",
};

function readApplicationEnvironment(environment: Record<string, string | undefined>): ApplicationEnvironment {
  const value = environment.APP_ENV ?? (environment.NODE_ENV === "test" ? "test" : "local");
  if (!["local", "test", "staging", "production"].includes(value)) throw new Error(`APP_ENV invalide : ${value}`);
  return value as ApplicationEnvironment;
}

export function readLegalConfiguration(environment: Record<string, string | undefined> = process.env) {
  const appEnvironment = readApplicationEnvironment(environment);
  const configured = Object.fromEntries(Object.entries(legalEnvironmentFields).map(([key, variable]) => [key, environment[variable]?.trim() || LEGAL_PLACEHOLDER])) as LegalInformation;
  const configuredMissing = Object.entries(configured).filter(([, value]) => value === LEGAL_PLACEHOLDER).map(([key]) => key as keyof LegalInformation);
  const useTemporaryProductionInformation = appEnvironment === "production" && configuredMissing.length > 0;
  const information = useTemporaryProductionInformation ? temporaryProductionInformation : configured;
  const missingFields = useTemporaryProductionInformation ? [] : configuredMissing;
  const informationStatus: LegalInformationStatus = useTemporaryProductionInformation || environment.LEGAL_INFORMATION_STATUS?.trim() === "temporary" ? "temporary" : "final";
  return { appEnvironment, informationStatus, information, missingFields };
}

export function validateLegalConfiguration(environment: Record<string, string | undefined> = process.env, warn: (message: string) => void = console.warn) {
  const configuration = readLegalConfiguration(environment);
  if (configuration.informationStatus === "temporary" && configuration.appEnvironment === "production") {
    warn("Informations légales temporaires utilisées en production. Remplacement par les données officielles requis avant lancement commercial public.");
  }
  if (!configuration.missingFields.length) return configuration;
  const message = `Informations légales manquantes : ${configuration.missingFields.join(", ")}`;
  if (configuration.appEnvironment === "production") throw new Error(`${message}. Build production interdit.`);
  if (configuration.appEnvironment !== "test") warn(`${message}. Placeholders autorisés en ${configuration.appEnvironment}.`);
  return configuration;
}

const legalConfiguration = validateLegalConfiguration();

export const legalInformation = legalConfiguration.information;
export const missingLegalInformation = legalConfiguration.missingFields;
export const temporaryLegalInformation = legalConfiguration.informationStatus === "temporary";
