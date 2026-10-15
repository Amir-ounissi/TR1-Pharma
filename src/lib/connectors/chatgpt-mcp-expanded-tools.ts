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
    name: "preview_tr1_priced_order",
    title: "Prévisualiser une commande avec remises et UG vérifiées",
    description: "Lecture seule. Calcule les prix HT catalogue, remises et unités gratuites par référence depuis les conditions TR1/HubSpot vérifiées. Refuse les conditions manquantes ou périmées. Ne crée ni ne transmet aucune commande.",
    inputSchema: {
      type: "object",
      properties: {
        brand_pharmacy_id: { type: "string", format: "uuid" },
        items: { type: "array", minItems: 1, maxItems: 30, items: {
          type: "object", properties: {
            product_id: { type: "string", format: "uuid" },
            quantity: { type: "integer", minimum: 1, maximum: 9999 },
          }, required: ["product_id","quantity"], additionalProperties: false,
        } },
      }, required: ["brand_pharmacy_id","items"], additionalProperties: false,
    },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    securitySchemes: [{ type: "oauth2", scopes: ["email"] }],
  },

  {
    name: "preview_tr1_ug_adjustments",
    title: "Prévisualiser les UG exceptionnelles sur une commande",
    description: "Lecture seule. Applique des exceptions UG UNIQUEMENT à cette commande sur le calcul commercial TR1/HubSpot vérifié. Pour chaque référence: mode add (ajouter aux UG normales) ou replace (remplacer les UG normales), quantité et classification obligatoires. L'offre exceptionnelle ne modifie jamais les conditions permanentes de la pharmacie. Aucun prix ou taux de remise fourni par le client n'est accepté.",
    inputSchema: {
      type: "object",
      properties: {
        brand_pharmacy_id: { type: "string", format: "uuid" },
        items: { type: "array", minItems: 1, maxItems: 30, items: {
          type: "object", properties: {
            product_id: { type: "string", format: "uuid" },
            quantity: { type: "integer", minimum: 1, maximum: 9999 },
          }, required: ["product_id","quantity"], additionalProperties: false,
        } },
        adjustments: { type: "array", minItems: 1, maxItems: 30, items: {
          type: "object", properties: {
            product_id: { type: "string", format: "uuid" },
            mode: { type: "string", enum: ["add","replace"], description: "add = en PLUS des UG commerciales; replace = À LA PLACE des UG commerciales (0 autorisé)" },
            quantity: { type: "integer", minimum: 0, maximum: 9999, description: "Nombre d'UG exceptionnelles à ajouter ou substituer" },
            classification: { type: "string", enum: [
              "compensation opé promo", "offre exceptionnelle sell-in", "geste commercial",
              "échange périmé", "échange déféctueux", "litige logistique", "cadeau challenge"
            ] },
          }, required: ["product_id","mode","quantity","classification"], additionalProperties: false,
        } },
      },
      required: ["brand_pharmacy_id","items","adjustments"], additionalProperties: false,
    },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    securitySchemes: [{ type: "oauth2", scopes: ["email"] }],
  },
  {
    name: "set_tr1_priced_order_ug_adjustments",
    title: "Appliquer les UG exceptionnelles confirmées au brouillon",
    description: "MODIFICATION DU BROUILLON NON ENVOYÉ uniquement. Après prévisualisation et confirmation EXPLICITE, définit la liste exhaustive des exceptions UG d'une commande Naali appartenant à l'utilisateur: add en supplément des UG commerciales, replace à la place des UG commerciales, y compris 0 pour supprimer les UG commerciales d'une ligne. Les exceptions sont classifiées et historisées par référence, sans changer les règles permanentes. La liste vide supprime les exceptions et rétablit les UG standard. Exige ensuite review_tr1_priced_order et une confirmation distincte avant tout envoi HubSpot.",
    inputSchema: {
      type: "object",
      properties: {
        order_id: { type: "string", format: "uuid", description: "Brouillon chiffré créé par create_tr1_priced_order_draft" },
        request_id: { type: "string", format: "uuid", description: "Clé identique à celle du brouillon" },
        adjustments: { type: "array", maxItems: 30, items: {
          type: "object", properties: {
            product_id: { type: "string", format: "uuid" },
            mode: { type: "string", enum: ["add","replace"] },
            quantity: { type: "integer", minimum: 0, maximum: 9999 },
            classification: { type: "string", enum: [
              "compensation opé promo", "offre exceptionnelle sell-in", "geste commercial",
              "échange périmé", "échange déféctueux", "litige logistique", "cadeau challenge"
            ] },
          }, required: ["product_id","mode","quantity","classification"], additionalProperties: false,
        } },
        confirmed: { type: "boolean", const: true, description: "Vrai seulement après confirmation explicite des écarts d'UG de cette commande" },
      },
      required: ["order_id","request_id","adjustments","confirmed"], additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    securitySchemes: [{ type: "oauth2", scopes: ["email"] }],
  },
  {
    name: "create_tr1_priced_order_draft",
    title: "Créer un brouillon avec prix, remises et UG vérifiés",
    description: "Crée uniquement un BROUILLON NON ENVOYÉ avec remises et unités gratuites calculées depuis TR1/HubSpot. Si fourni, conserve le numéro du bon d’origine dans order_number, distinct de l’identifiant technique ChatGPT. Exige prévisualisation et confirmation. Ne transmet jamais la commande.",
    inputSchema: {
      type: "object",
      properties: {
        brand_pharmacy_id: { type: "string", format: "uuid" },
        items: { type: "array", minItems: 1, maxItems: 30, items: {
          type: "object", properties: {
            product_id: { type: "string", format: "uuid" },
            quantity: { type: "integer", minimum: 1, maximum: 9999 },
          }, required: ["product_id","quantity"], additionalProperties: false,
        } },
        order_type: { type: "string", enum: ["initial","reorder","complementary","replacement","sample","return","credit_note","other"] },
        request_id: { type: "string", format: "uuid" },
        source_order_number: { type: "string", minLength: 1, maxLength: 80, description: "Numéro du bon de commande fourni par la pharmacie, ex. 156589. Facultatif, distinct du numéro technique ChatGPT/HubSpot." },
        confirmed: { type: "boolean", const: true },
      }, required: ["brand_pharmacy_id","items","order_type","request_id","confirmed"], additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    securitySchemes: [{ type: "oauth2", scopes: ["email"] }],
  },
  {
    name: "review_tr1_priced_order",
    title: "Relire le brouillon chiffré avant validation HubSpot",
    description: "Lecture seule. Vérifie les lignes enregistrées, les remises et UG et retourne un jeton de revue. Présenter impérativement le détail et les totaux à l'utilisateur avant de demander sa confirmation. Aucune transmission.",
    inputSchema: {
      type: "object", properties: {
        order_id: { type: "string", format: "uuid", description: "Identifiant du brouillon chiffré TR1" },
        request_id: { type: "string", format: "uuid", description: "Identifiant stable employé à la création du brouillon" },
      }, required: ["order_id","request_id"], additionalProperties: false,
    },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    securitySchemes: [{ type: "oauth2", scopes: ["email"] }],
  },
  {
    name: "submit_tr1_priced_order_to_hubspot",
    title: "Valider une commande TR1 et la synchroniser dans HubSpot",
    description: "MODIFICATION RÉELLE : fait passer un brouillon chiffré Naali au statut pending et synchronise immédiatement sa transaction et ses lignes HubSpot. Exige une revue préalable avec review_tr1_priced_order, le jeton correspondant et une confirmation EXPLICITE de l'utilisateur après examen de la pharmacie, des produits, quantités, remises, UG et totaux. Ne transmet pas d'email de commande à la marque. En cas d'échec HubSpot, l'ordre demeure soumis dans TR1 et peut être resynchronisé en rappelant l'outil avec les mêmes identifiants (sans doublon).",
    inputSchema: {
      type: "object", properties: {
        order_id: { type: "string", format: "uuid" },
        request_id: { type: "string", format: "uuid" },
        review_token: { type: "string", pattern: "^[0-9a-f]{32}$", description: "Jeton retourné par la revue immédiate du brouillon" },
        confirmed: { type: "boolean", const: true },
      }, required: ["order_id","request_id","review_token","confirmed"], additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    securitySchemes: [{ type: "oauth2", scopes: ["email"] }],
  },
  {
    name: "preview_tr1_black_friday_preorder",
    title: "Prévisualiser une précommande Trade Black Friday Naali",
    description: "Lecture seule. Calcule la remise HT du catalogue/HubSpot et les UG commerciales EXPLICITEMENT indiquées pour chaque référence. Calcule automatiquement 1 cadeau consommateur par unité facturée ou offerte, réparti moitié Dream x20 et moitié Anti-Stress x20. Le total doit être pair. Ne crée aucune commande; refuser les références arrêtées Zen fraise / Fruits des Bois.",
    inputSchema: {
      type: "object",
      properties: {
        brand_pharmacy_id: { type: "string", format: "uuid" },
        items: { type: "array", minItems: 1, maxItems: 30, items: {
          type: "object", properties: {
            product_id: { type: "string", format: "uuid" },
            quantity: { type: "integer", minimum: 1, maximum: 9999 },
            free_quantity: { type: "integer", minimum: 0, maximum: 9999, description: "UG commerciales confirmées pour CETTE précommande (non les conditions permanentes)" },
          }, required: ["product_id","quantity","free_quantity"], additionalProperties: false,
        } },
      }, required: ["brand_pharmacy_id","items"], additionalProperties: false,
    },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    securitySchemes: [{ type: "oauth2", scopes: ["email"] }],
  },
  {
    name: "create_tr1_black_friday_preorder_draft",
    title: "Créer un brouillon Black Friday non transmis",
    description: "MODIFICATION TR1 SEULEMENT. Après aperçu et approbation EXPLICITE du panier, crée un brouillon Naali de type Réassort/Précommande Opération Trade, avec numéro source, prix catalogue et remise HubSpot, UG classées conditions commerciales et cadeaux Black Friday calculés automatiquement 50/50. Ne transmet rien à HubSpot. Utiliser un UUID request_id stable. Ne recréez JAMAIS un bon déjà enregistré dans HubSpot, notamment Praden n°492986.",
    inputSchema: {
      type: "object",
      properties: {
        brand_pharmacy_id: { type: "string", format: "uuid" },
        items: { type: "array", minItems: 1, maxItems: 30, items: {
          type: "object", properties: {
            product_id: { type: "string", format: "uuid" },
            quantity: { type: "integer", minimum: 1, maximum: 9999 },
            free_quantity: { type: "integer", minimum: 0, maximum: 9999 },
          }, required: ["product_id","quantity","free_quantity"], additionalProperties: false,
        } },
        source_order_number: { type: "string", minLength: 1, maxLength: 80 },
        request_id: { type: "string", format: "uuid" },
        confirmed: { type: "boolean", const: true },
      },
      required: ["brand_pharmacy_id","items","source_order_number","request_id","confirmed"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    securitySchemes: [{ type: "oauth2", scopes: ["email"] }],
  },
  {
    name: "review_tr1_black_friday_preorder",
    title: "Revoir les produits, UG, cadeaux et totaux de la précommande",
    description: "Lecture seule. Revérifie les prix/UG commerciaux saisis, les cadeaux automatiques Black Friday, le numéro source, le montant et les champs HubSpot avant de délivrer le jeton de revue. Aucune transmission.",
    inputSchema: {
      type: "object", properties: {
        order_id: { type: "string", format: "uuid" },
        request_id: { type: "string", format: "uuid" },
      }, required: ["order_id","request_id"], additionalProperties: false,
    },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    securitySchemes: [{ type: "oauth2", scopes: ["email"] }],
  },
  {
    name: "submit_tr1_black_friday_preorder_to_hubspot",
    title: "Enregistrer la précommande Black Friday dans HubSpot",
    description: "MODIFICATION RÉELLE. Uniquement après revue et confirmation distincte EXPLICITE, envoie la précommande en étape Précommande du pipeline commercial, Type Réassort, type Précommande Opération Trade, motif Black Friday 2026. Crée les lignes payantes + UG + cadeaux consommateurs 50/50 à zéro euro. N'envoie aucun email ni n'ordonne l'expédition. Retenter avec les MÊMES identifiants en cas d'échec de synchronisation, sans doublon.",
    inputSchema: {
      type: "object", properties: {
        order_id: { type: "string", format: "uuid" },
        request_id: { type: "string", format: "uuid" },
        review_token: { type: "string", pattern: "^[0-9a-f]{32}$" },
        confirmed: { type: "boolean", const: true },
      },
      required: ["order_id","request_id","review_token","confirmed"],
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

const pricedPreviewArgs = z.object({
  brand_pharmacy_id: uuid,
  items: z.array(z.object({ product_id: uuid, quantity: z.number().int().min(1).max(9999) }).strict())
    .min(1).max(30).refine(items => new Set(items.map(i => i.product_id)).size === items.length),
}).strict();

const adjustmentItemArgs = z.object({
  product_id: uuid,
  mode: z.enum(["add","replace"]),
  quantity: z.number().int().min(0).max(9999),
  classification: z.enum([
    "compensation opé promo", "offre exceptionnelle sell-in", "geste commercial",
    "échange périmé", "échange déféctueux", "litige logistique", "cadeau challenge",
  ]),
}).strict().refine(a => a.mode === "replace" || a.quantity > 0);
const adjustmentListArgs = z.array(adjustmentItemArgs).max(30)
  .refine(items => new Set(items.map(i => i.product_id)).size === items.length);
const adjustedPreviewArgs = pricedPreviewArgs.extend({
  adjustments: adjustmentListArgs.refine(items => items.length > 0),
}).superRefine((input, ctx) => {
  const ids = new Set(input.items.map(i => i.product_id));
  if (input.adjustments.some(a => !ids.has(a.product_id))) {
    ctx.addIssue({ code: "custom", message: "UG adjustment product not in basket" });
  }
});
const setDraftAdjustmentsArgs = z.object({
  order_id: uuid,
  request_id: uuid,
  adjustments: adjustmentListArgs,
  confirmed: z.literal(true),
}).strict();

const pricedDraftArgs = pricedPreviewArgs.extend({
  order_type: z.enum(["initial","reorder","complementary","replacement","sample","return","credit_note","other"]),
  request_id: uuid,
  source_order_number: z.string().trim().min(1).max(80).regex(/^[^\u0000-\u001f\u007f]+$/).optional(),
  confirmed: z.literal(true),
});

const tradePreorderItemArgs = z.object({
  product_id: uuid,
  quantity: z.number().int().min(1).max(9999),
  free_quantity: z.number().int().min(0).max(9999),
}).strict().refine(x => x.quantity + x.free_quantity <= 9999);
const tradePreorderPreviewArgs = z.object({
  brand_pharmacy_id: uuid,
  items: z.array(tradePreorderItemArgs).min(1).max(30)
    .refine(items => new Set(items.map(i => i.product_id)).size === items.length)
    .refine(items => items.reduce((n,i) => n + i.quantity + i.free_quantity,0) % 2 === 0),
}).strict();
const tradePreorderDraftArgs = tradePreorderPreviewArgs.extend({
  source_order_number: z.string().trim().min(1).max(80).regex(/^[^\u0000-\u001f\u007f]+$/),
  request_id: uuid,
  confirmed: z.literal(true),
});
const reviewedOrderArgs = z.object({ order_id: uuid, request_id: uuid }).strict();
const submittedOrderArgs = reviewedOrderArgs.extend({
  review_token: z.string().regex(/^[0-9a-f]{32}$/),
  confirmed: z.literal(true),
});

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
  if (name === "preview_tr1_priced_order") {
    const parsed = pricedPreviewArgs.safeParse(args);
    if (!parsed.success) return null;
    return { rpc: "tr1_chatgpt_priced_order_preview",
      args: { target_brand_pharmacy_id: parsed.data.brand_pharmacy_id,
        draft_items: parsed.data.items }, responseKey: "preview", write: false };
  }

  if (name === "preview_tr1_ug_adjustments") {
    const parsed = adjustedPreviewArgs.safeParse(args);
    if (!parsed.success) return null;
    return { rpc: "tr1_chatgpt_ug_adjusted_preview",
      args: { target_brand_pharmacy_id: parsed.data.brand_pharmacy_id,
        draft_items: parsed.data.items, adjustments: parsed.data.adjustments },
      responseKey: "preview", write: false };
  }
  if (name === "set_tr1_priced_order_ug_adjustments") {
    const parsed = setDraftAdjustmentsArgs.safeParse(args);
    if (!parsed.success) return null;
    return { rpc: "tr1_chatgpt_set_draft_ug_adjustments",
      args: { target_order_id: parsed.data.order_id,
        request_id: parsed.data.request_id, adjustments: parsed.data.adjustments,
        confirmed: true },
      responseKey: "adjusted_draft", write: true };
  }
  if (name === "create_tr1_priced_order_draft") {
    const parsed = pricedDraftArgs.safeParse(args);
    if (!parsed.success) return null;
    return { rpc: parsed.data.source_order_number
      ? "tr1_chatgpt_create_priced_order_draft_with_reference"
      : "tr1_chatgpt_create_priced_order_draft",
      args: { target_brand_pharmacy_id: parsed.data.brand_pharmacy_id,
        draft_items: parsed.data.items, order_type: parsed.data.order_type,
        request_id: parsed.data.request_id, confirmed: true,
        ...(parsed.data.source_order_number
          ? { source_order_number: parsed.data.source_order_number } : {}) },
      responseKey: "draft", write: true };
  }
  if (name === "review_tr1_priced_order") {
    const parsed = reviewedOrderArgs.safeParse(args);
    if (!parsed.success) return null;
    return { rpc: "tr1_chatgpt_review_priced_order",
      args: { target_order_id: parsed.data.order_id, request_id: parsed.data.request_id },
      responseKey: "review", write: false };
  }
  if (name === "submit_tr1_priced_order_to_hubspot") {
    const parsed = submittedOrderArgs.safeParse(args);
    if (!parsed.success) return null;
    return { rpc: "tr1_chatgpt_submit_priced_order",
      args: { target_order_id: parsed.data.order_id, request_id: parsed.data.request_id,
        review_token: parsed.data.review_token, confirmed: true },
      responseKey: "submission", write: true };
  }
  if (name === "preview_tr1_black_friday_preorder") {
    const parsed = tradePreorderPreviewArgs.safeParse(args);
    if (!parsed.success) return null;
    return { rpc: "tr1_chatgpt_trade_preorder_preview",
      args: { target_brand_pharmacy_id: parsed.data.brand_pharmacy_id,
        draft_items: parsed.data.items }, responseKey: "preview", write: false };
  }
  if (name === "create_tr1_black_friday_preorder_draft") {
    const parsed = tradePreorderDraftArgs.safeParse(args);
    if (!parsed.success) return null;
    return { rpc: "tr1_chatgpt_create_trade_preorder_draft",
      args: { target_brand_pharmacy_id: parsed.data.brand_pharmacy_id,
        draft_items: parsed.data.items, source_order_number: parsed.data.source_order_number,
        request_id: parsed.data.request_id, confirmed: true },
      responseKey: "draft", write: true };
  }
  if (name === "review_tr1_black_friday_preorder") {
    const parsed = reviewedOrderArgs.safeParse(args);
    if (!parsed.success) return null;
    return { rpc: "tr1_chatgpt_review_trade_preorder",
      args: { target_order_id: parsed.data.order_id, request_id: parsed.data.request_id },
      responseKey: "review", write: false };
  }
  if (name === "submit_tr1_black_friday_preorder_to_hubspot") {
    const parsed = submittedOrderArgs.safeParse(args);
    if (!parsed.success) return null;
    return { rpc: "tr1_chatgpt_submit_trade_preorder",
      args: { target_order_id: parsed.data.order_id, request_id: parsed.data.request_id,
        review_token: parsed.data.review_token, confirmed: true },
      responseKey: "submission", write: true };
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
