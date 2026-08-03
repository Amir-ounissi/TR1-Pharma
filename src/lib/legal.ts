const missing = "À renseigner avant exposition publique";

function value(name: string) {
  return process.env[name]?.trim() || missing;
}

export const legalInformation = {
  companyName: value("LEGAL_COMPANY_NAME"),
  companyForm: value("LEGAL_COMPANY_FORM"),
  shareCapital: value("LEGAL_SHARE_CAPITAL"),
  registeredOffice: value("LEGAL_REGISTERED_OFFICE"),
  registrationNumber: value("LEGAL_REGISTRATION_NUMBER"),
  vatNumber: value("LEGAL_VAT_NUMBER"),
  publicationDirector: value("LEGAL_PUBLICATION_DIRECTOR"),
  contactEmail: value("LEGAL_CONTACT_EMAIL"),
  hostName: value("LEGAL_HOST_NAME"),
  hostAddress: value("LEGAL_HOST_ADDRESS"),
  dataController: value("PRIVACY_DATA_CONTROLLER"),
  privacyContactEmail: value("PRIVACY_CONTACT_EMAIL"),
  retentionPeriod: value("PRIVACY_RETENTION_PERIOD"),
  legalBasis: value("PRIVACY_LEGAL_BASIS"),
  privacyLastUpdated: value("PRIVACY_LAST_UPDATED"),
};

export const missingLegalInformation = Object.entries(legalInformation)
  .filter(([, fieldValue]) => fieldValue === missing)
  .map(([field]) => field);
