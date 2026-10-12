import { z } from "zod";

// Tool names and input schemas must stay in sync with the SQL RPCs.
// These are intentionally narrow. No tool may submit or transmit an order.
const uuid = z.string().uuid();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const isoDateTime = z.string().datetime({ offset: true });

export const expandedTools = [
  {
    name: "list_tr1_catalog",
    title: "Catalogue et prix HT d'une marque TR1",
    description: "Liste au maximum 50 produits actifs, leurs prix catalogue HT et quantités minimales. Les remises et unités gratuites spécifiques à la pharmacie ne sont pas incluses.",
    inputSchema: {
      type: "object",
      properties: {
        brand_id: { type: "string", format: "uuid", description: "Marque autorisée issue de list_tr1_brands" },
        q: { type: "string", maxLength: 120, description: "Filtre facultatif de nom ou SKU" },
      },
      required: ["brand_id"], additionalProperties: false,
    },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    securitySchemes: [{ type: "oauth2", scopes: ["email"] }],
  },
  {
    name: "get_tr1_agenda",
    title: "Consulter mon agenda TR1",
    description: "Consulte uniquement les événements de mon agenda TR1 sur 15 jours maximum. Aucune modification.",
    inputSchema: {
      type: "object",
      properties: {
        start_date: { type: "string", format: "date" },
        end_date: { type: "string", format: "date", description: "Inclus, au plus 14 jours après start_date" },
      },
      required: ["start_date", "end_date"], additionalProperties: false,
    },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    securitySchemes: [{ type: "oauth2", scopes: ["email"] }],
  },
  {
    name: "create_tr1_planned_visit",
    title: "Enregistrer une visite planifiée TR1",
    description: "MODIFICATION TR1 : créer une visite planifiée, PAS une confirmation du pharmacien. D'abord consulter l'agenda et présenter à l'utilisateur pharmacie, marques, heure, durée et objectif. N'appeler cet outil qu'après son accord EXPLICITE. Le champ confirmed doit être vrai. Une visite physique multimarque ne doit être créée qu'une fois.",
    inputSchema: {
      type: "object",
      properties: {
        pharmacy_id: { type: "string", format: "uuid", description: "Identifiant global de pharmacie issu de search_tr1_pharmacies" },
        brand_pharmacy_ids: { type: "array", minItems: 1, maxItems: 5, uniqueItems: true, items: { type: "string", format: "uuid" }, description: "Relations marque-pharmacie pour une même pharmacie" },
        visit_kind: { type: "string", enum: ["client_visit","prospecting","relationship","training","other"] },
        title: { type: "string", minLength: 2, maxLength: 160 },
        objective: { type: "string", maxLength: 1000 },
        start_at: { type: "string", format: "date-time", description: "Date et heure ISO 8601 avec décalage Europe/Paris (ex. +02:00)" },
        end_at: { type: "string", format: "date-time", description: "Durée entre 15 minutes et 4 heures" },
        confirmed: { type: "boolean", const: true, description: "Vrai uniquement APRÈS confirmation explicite de l'utilisateur" },
      },
      required: ["pharmacy_id","brand_pharmacy_ids","visit_kind","title","start_at","end_at","confirmed"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    securitySchemes: [{ type: "oauth2", scopes: ["email"] }],
  },
  {
    name: "create_tr1_order_draft",
    title: "Créer un brouillon de commande TR1",
    description: "MODIFICATION TR1 : créer uniquement un BROUILLON NON ENVOYÉ. Toujours consulter le catalogue, afficher les lignes, quantités et prix HT catalogue à l'utilisateur puis demander sa confirmation EXPLICITE. Ne calcule PAS automatiquement les remises ni UG : vérification obligatoire dans TR1 avant transmission. Ne jamais annoncer qu'une commande a été envoyée.",
    inputSchema: {
      type: "object",
      properties: {
        brand_pharmacy_id: { type: "string", format: "uuid", description: "Identifiant relation marque-pharmacie issue de search_tr1_pharmacies" },
        items: { type: "array", minItems: 1, maxItems: 30, items: {
          type: "object", properties: {
            product_id: { type: "string", format: "uuid" },
            quantity: { type: "integer", minimum: 1, maximum: 9999 },
          }, required: ["product_id","quantity"], additionalProperties: false,
        } },
        order_type: { type: "string", enum: ["initial","reorder","complementary","replacement","sample","return","credit_note","other"] },
        note: { type: "string", maxLength: 1000 },
        request_id: { type: "string", format: "uuid", description: "Clé unique stable pour retenter la même opération sans double commande ; réutiliser sur retry" },
        confirmed: { type: "boolean", const: true, description: "Vrai uniquement APRÈS confirmation explicite du brouillon par l'utilisateur" },
      },
      required: ["brand_pharmacy_id","items","order_type","request_id","confirmed"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    securitySchemes: [{ type: "oauth2", scopes: ["email"] }],
  },
] as const;

const catalogArgs = z.object({ brand_id: uuid, q: z.string().max(120).optional() }).strict();
const agendaArgs = z.object({ start_date: isoDate, end_date: isoDate }).strict();
const visitArgs = z.object({
  pharmacy_id: uuid,
  brand_pharmacy_ids: z.array(uuid).min(1).max(5).refine(a => new Set(a).size === a.length),
  visit_kind: z.enum(["client_visit","prospecting","relationship","training","other"]),
  title: z.string().trim().min(2).max(160),
  objective: z.string().max(1000).optional(),
  start_at: isoDateTime,
  end_at: isoDateTime,
  confirmed: z.literal(true),
}).strict();
const orderArgs = z.object({
  brand_pharmacy_id: uuid,
  items: z.array(z.object({ product_id: uuid, quantity: z.number().int().min(1).max(9999) }).strict()).min(1).max(30)
    .refine(items => new Set(items.map(i => i.product_id)).size === items.length),
  order_type: z.enum(["initial","reorder","complementary","replacement","sample","return","credit_note","other"]),
  note: z.string().max(1000).optional(),
  request_id: uuid,
  confirmed: z.literal(true),
}).strict();

export function parseExpandedToolCall(name: string, args: unknown):
  | { rpc: string; args: Record<string, unknown>; responseKey: string; write: boolean }
  | null {
  if (name === "list_tr1_catalog") {
    const parsed = catalogArgs.safeParse(args);
    if (!parsed.success) return null;
    return { rpc: "tr1_chatgpt_catalog",
      args: { target_brand_id: parsed.data.brand_id, search_text: parsed.data.q ?? null },
      responseKey: "products", write: false };
  }
  if (name === "get_tr1_agenda") {
    const parsed = agendaArgs.safeParse(args);
    if (!parsed.success || parsed.data.end_date < parsed.data.start_date) return null;
    return { rpc: "tr1_chatgpt_agenda",
      args: { start_date: parsed.data.start_date, end_date: parsed.data.end_date },
      responseKey: "events", write: false };
  }
  if (name === "create_tr1_planned_visit") {
    const parsed = visitArgs.safeParse(args);
    if (!parsed.success) return null;
    return { rpc: "tr1_chatgpt_create_planned_visit",
      args: {
        target_pharmacy_id: parsed.data.pharmacy_id,
        target_brand_pharmacy_ids: parsed.data.brand_pharmacy_ids,
        visit_kind: parsed.data.visit_kind,
        visit_title: parsed.data.title,
        visit_objective: parsed.data.objective ?? "",
        start_at: parsed.data.start_at,
        end_at: parsed.data.end_at,
        confirmed: true,
      }, responseKey: "visit_id", write: true };
  }
  if (name === "create_tr1_order_draft") {
    const parsed = orderArgs.safeParse(args);
    if (!parsed.success) return null;
    return { rpc: "tr1_chatgpt_create_order_draft",
      args: {
        target_brand_pharmacy_id: parsed.data.brand_pharmacy_id,
        draft_items: parsed.data.items,
        order_type: parsed.data.order_type,
        note: parsed.data.note ?? "",
        request_id: parsed.data.request_id,
        confirmed: true,
      }, responseKey: "draft", write: true };
  }
  return null;
}
