const required = {
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
};

const environment = process.argv[2] ?? process.env.APP_ENV ?? "local";
const missing = Object.entries(required).filter(([, variable]) => !process.env[variable]?.trim()).map(([field]) => field);
if (!missing.length) {
  console.log(`Configuration juridique ${environment} : OK`);
  process.exit(0);
}
const message = `Informations juridiques manquantes : ${missing.join(", ")}`;
if (environment === "production") {
  console.error(`${message}. Production interdite.`);
  process.exit(1);
}
console.warn(`${message}. Placeholders autorisés en ${environment}.`);
