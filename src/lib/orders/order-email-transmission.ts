import { z } from "zod";

const emailSchema = z.string().trim().email().max(320);
const allowedDocuments = new Set(["kbis", "rib"] as const);

export type OrderTransmissionDocumentType = "kbis" | "rib" | "sepa";

export type OrderEmailTransmissionConfig = {
  enabled: boolean;
  recipientEmail: string | null;
  ccEmails: string[];
  requireVat: boolean;
  requiredDocuments: OrderTransmissionDocumentType[];
  subjectTemplate: string | null;
  bodyTemplate: string | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function validEmail(value: unknown) {
  if (typeof value !== "string") return null;
  const parsed = emailSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function validEmailList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(validEmail).filter((email): email is string => Boolean(email)))];
}

function optionalTemplate(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed && trimmed.length <= 20_000 ? value : null;
}

export function resolveOrderEmailTransmissionConfig(
  configuration: Record<string, unknown> | null | undefined,
  fallbackRecipient?: string | null,
): OrderEmailTransmissionConfig {
  const raw = asRecord(configuration?.order_email_transmission);
  const requiredDocuments: OrderTransmissionDocumentType[] = Array.isArray(raw?.required_documents)
    ? raw.required_documents.filter(
        (value): value is OrderTransmissionDocumentType =>
          typeof value === "string" && allowedDocuments.has(value as OrderTransmissionDocumentType),
      )
    : ["kbis", "rib"];

  return {
    enabled: raw?.enabled === true,
    recipientEmail: validEmail(raw?.recipient_email) ?? validEmail(fallbackRecipient),
    ccEmails: validEmailList(raw?.cc_emails),
    requireVat: raw?.require_vat !== false,
    requiredDocuments: [...new Set(requiredDocuments)],
    subjectTemplate: optionalTemplate(raw?.subject_template),
    bodyTemplate: optionalTemplate(raw?.body_template),
  };
}

export function parseOrderCcEmails(value: string) {
  if (!value.trim()) return [] as string[];
  const candidates = value
    .split(/[;,\n]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
  const parsed = candidates.map((candidate) => emailSchema.safeParse(candidate));
  if (parsed.some((entry) => !entry.success)) {
    throw new Error("Une adresse en copie (Cc) n’est pas valide.");
  }
  return [...new Set(parsed.map((entry) => (entry.success ? entry.data : "")).filter(Boolean))];
}

function formatTotal(value: number | string | null | undefined) {
  const amount = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(amount)
    ? amount.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : "0,00";
}

function renderTemplate(template: string, values: Record<string, string>) {
  return template.replace(/{{\s*([a-z_]+)\s*}}/gi, (match, key: string) => values[key.toLowerCase()] ?? match);
}

export function buildOrderEmailDraft(input: {
  brandName: string;
  pharmacyName: string;
  reference: string;
  vatNumber?: string | null;
  totalTtc?: number | string | null;
  config: OrderEmailTransmissionConfig;
}) {
  const values = {
    brand_name: input.brandName,
    pharmacy_name: input.pharmacyName,
    reference: input.reference,
    vat_number: input.vatNumber?.trim() || "Non renseigné",
    total_ttc: `${formatTotal(input.totalTtc)} €`,
  };

  const defaultSubject = "Commande {{brand_name}} · {{pharmacy_name}} · {{reference}}";
  const defaultBody = [
    "Bonjour,",
    "",
    "Vous trouverez ci-joint la commande {{reference}} pour {{pharmacy_name}}.",
    "",
    "N° TVA : {{vat_number}}",
    "Total TTC : {{total_ttc}}",
    "",
    "Bonne réception,",
  ].join("\n");

  return {
    subject: renderTemplate(input.config.subjectTemplate ?? defaultSubject, values),
    body: renderTemplate(input.config.bodyTemplate ?? defaultBody, values),
  };
}


export function isVkSwissBrand(input: { name?: string | null; code?: string | null }) {
  const normalize = (value: string | null | undefined) =>
    (value ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]/g, "")
      .toUpperCase();

  const code = normalize(input.code);
  const name = normalize(input.name);
  return code === "VKSWISS" || name === "VKSWISS" || (name.includes("VK") && name.includes("SWISS"));
}
