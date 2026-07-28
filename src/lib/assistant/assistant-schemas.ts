import { z } from "zod";

export const databaseUuid = z.string().regex(
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
);

export const assistantIntentSchema = z.enum([
  "search_pharmacies",
  "get_pharmacy_summary",
  "get_next_visit",
  "get_today_agenda",
  "get_recent_interactions",
  "prepare_interaction",
  "prepare_task",
  "prepare_interaction_with_next_action",
  "unknown",
]);

export type AssistantIntent = z.infer<typeof assistantIntentSchema>;

export const assistantActionTypeSchema = z.enum([
  "interaction",
  "task",
  "interaction_with_next_action",
]);

export type AssistantActionType = z.infer<typeof assistantActionTypeSchema>;

export const interactionPayloadSchema = z.object({
  interaction_type: z.enum(["call", "email", "visit", "video_call", "message", "other"]),
  outcome: z.enum([
    "no_answer",
    "callback_requested",
    "information_sent",
    "appointment_booked",
    "offer_requested",
    "offer_sent",
    "interested",
    "not_interested",
    "decision_pending",
    "order_expected",
    "completed",
    "other",
  ]),
  subject: z.string().trim().min(1).max(160),
  notes: z.string().trim().min(2).max(1000),
  occurred_at: z.string().datetime(),
  next_action_type: z.enum([
    "call",
    "email",
    "visit",
    "appointment",
    "send_offer",
    "follow_up",
    "qualify",
    "update_contact",
    "check_stock",
    "request_order",
    "other",
  ]).optional(),
  next_action_at: z.string().datetime().optional(),
}).strict().superRefine((value, context) => {
  if ((value.next_action_type && !value.next_action_at) || (!value.next_action_type && value.next_action_at)) {
    context.addIssue({ code: "custom", message: "La prochaine action et sa date doivent être définies ensemble." });
  }
});

export const taskPayloadSchema = z.object({
  task_type: z.enum([
    "call",
    "email",
    "visit",
    "appointment",
    "send_offer",
    "follow_up",
    "qualify",
    "update_contact",
    "check_stock",
    "request_order",
    "other",
  ]),
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(1000).optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  due_at: z.string().datetime(),
}).strict();

export const assistantDraftPayloadSchema = z.union([interactionPayloadSchema, taskPayloadSchema]);

export const assistantDraftSchema = z.object({
  id: databaseUuid,
  organization_id: databaseUuid,
  brand_id: databaseUuid,
  user_id: databaseUuid,
  pharmacy_id: databaseUuid,
  brand_pharmacy_id: databaseUuid,
  action_type: assistantActionTypeSchema,
  payload: z.record(z.string(), z.unknown()),
  status: z.enum(["pending", "confirmed", "cancelled", "expired", "failed"]),
  confidence: z.coerce.number().min(0).max(1).nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  expires_at: z.string(),
  confirmed_at: z.string().nullable(),
  cancelled_at: z.string().nullable(),
  executed_action_id: databaseUuid.nullable(),
  error_message: z.string().nullable(),
});

export type AssistantDraft = z.infer<typeof assistantDraftSchema>;

export const pharmacyMatchSchema = z.object({
  brand_pharmacy_id: databaseUuid,
  pharmacy_id: databaseUuid,
  pharmacy_name: z.string(),
  city: z.string().nullable(),
  postal_code: z.string().nullable(),
  address_line_1: z.string().nullable(),
  phone: z.string().nullable(),
  commercial_status: z.string(),
  priority_level: z.string(),
  potential_level: z.string(),
  territory_id: databaseUuid.nullable(),
});

export type PharmacyMatch = z.infer<typeof pharmacyMatchSchema>;

export const assistantMessageSchema = z.object({
  message: z.string().trim().min(1).max(1200),
  timezone: z.string().trim().min(1).max(80),
  selectedBrandPharmacyId: databaseUuid.optional(),
}).strict();

export type AssistantResponse =
  | { kind: "answer"; message: string; details?: Record<string, unknown> }
  | { kind: "clarification"; message: string }
  | { kind: "disambiguation"; message: string; choices: PharmacyMatch[]; originalMessage: string }
  | { kind: "draft"; message: string; pharmacy: PharmacyMatch; draft: AssistantDraft }
  | { kind: "cancelled"; message: string; draftId: string }
  | { kind: "confirmed"; message: string; actionId: string; alreadyConfirmed: boolean }
  | { kind: "error"; message: string };
