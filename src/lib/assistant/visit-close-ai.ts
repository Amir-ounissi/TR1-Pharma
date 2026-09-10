import { z } from "zod";
import { todayInParis } from "@/lib/agenda";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const VERCEL_AI_GATEWAY_RESPONSES_URL = "https://ai-gateway.vercel.sh/v1/responses";
export const DEFAULT_VISIT_CLOSE_MODEL = "gpt-5.6-luna";
export const MAX_VISIT_CLOSE_NOTE_CHARS = 2_000;

const visitOutcome = z.enum(["very_good", "good", "follow_up", "problem"]);
const nextVisit = z.enum(["none", "week1", "weeks2", "month1", "custom"]);
const visitTag = z.enum(["order", "merchandising", "stockout", "competitor", "callback", "problem"]);

const visitCloseDraft = z.object({
  summary: z.string().trim().min(1).max(500),
  outcome: visitOutcome,
  next: nextVisit,
  customNext: z.string().nullable(),
  tags: z.array(visitTag).max(6),
});

export type VisitCloseDraft = z.infer<typeof visitCloseDraft>;

const VISIT_CLOSE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "outcome", "next", "customNext", "tags"],
  properties: {
    summary: { type: "string", minLength: 1, maxLength: 500 },
    outcome: { type: "string", enum: ["very_good", "good", "follow_up", "problem"] },
    next: { type: "string", enum: ["none", "week1", "weeks2", "month1", "custom"] },
    customNext: { type: ["string", "null"] },
    tags: {
      type: "array",
      maxItems: 6,
      items: { type: "string", enum: ["order", "merchandising", "stockout", "competitor", "callback", "problem"] },
    },
  },
} as const;

const VISIT_CLOSE_INSTRUCTIONS = `Tu structures une note de fin de visite d'un commercial en pharmacie. N'invente rien.
Retourne un résumé factuel et court (500 caractères max), le résultat de visite et les suites utiles.
outcome: very_good = succès commercial clair/commande; good = visite positive ou normale; follow_up = décision ou action à reprendre; problem = incident, refus fort ou problème.
next: week1, weeks2 ou month1 seulement si la note l'indique clairement; custom uniquement si une date ET une heure précises sont explicites; sinon none.
customNext doit être au format YYYY-MM-DDTHH:mm pour custom, sinon null.
tags: uniquement les signaux réellement présents dans la note.`;

type Fetcher = typeof fetch;
type OpenAIUsage = {
  input_tokens?: number;
  input_tokens_details?: { cached_tokens?: number };
  output_tokens?: number;
  output_tokens_details?: { reasoning_tokens?: number };
  total_tokens?: number;
};

type ResponsesPayload = {
  output_text?: string;
  output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
  usage?: OpenAIUsage;
};

type VisitCloseProvider = {
  apiKey: string;
  endpoint: string;
  model: string;
  pricingModel: string;
  source: "openai" | "vercel_ai_gateway";
};

export type VisitCloseUsage = {
  model: string;
  inputTokens: number | null;
  cachedInputTokens: number | null;
  outputTokens: number | null;
  reasoningTokens: number | null;
  totalTokens: number | null;
  estimatedCostUsd: number | null;
  latencyMs: number;
};

type UsageSink = (usage: VisitCloseUsage) => void;

const MODEL_PRICING_PER_MILLION: Record<string, { input: number; cachedInput: number; output: number }> = {
  "gpt-5.6-luna": { input: 0.2, cachedInput: 0.02, output: 1.2 },
};

export class VisitCloseAiError extends Error {
  constructor(readonly code: "invalid_note" | "ai_unavailable" | "analysis_failed", message: string) {
    super(message);
  }
}

function validTokenCount(value: number | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

export function estimateVisitCloseCostUsd(model: string, usage: OpenAIUsage | undefined): number | null {
  const normalizedModel = model.startsWith("openai/") ? model.slice("openai/".length) : model;
  const pricing = MODEL_PRICING_PER_MILLION[normalizedModel];
  const inputTokens = validTokenCount(usage?.input_tokens);
  const outputTokens = validTokenCount(usage?.output_tokens);
  if (!pricing || inputTokens === null || outputTokens === null) return null;
  const cachedInput = Math.min(validTokenCount(usage?.input_tokens_details?.cached_tokens) ?? 0, inputTokens);
  const cost = ((inputTokens - cachedInput) * pricing.input + cachedInput * pricing.cachedInput + outputTokens * pricing.output) / 1_000_000;
  return Math.round(cost * 1_000_000_000) / 1_000_000_000;
}

function resolveProvider(): VisitCloseProvider | null {
  const requestedModel = process.env.OPENAI_VISIT_CLOSE_MODEL ?? DEFAULT_VISIT_CLOSE_MODEL;
  const directApiKey = process.env.OPENAI_API_KEY ?? process.env.OPEN_API_PREVIEW_KEY;
  if (directApiKey) {
    return {
      apiKey: directApiKey,
      endpoint: OPENAI_RESPONSES_URL,
      model: requestedModel,
      pricingModel: requestedModel,
      source: "openai",
    };
  }
  const gatewayApiKey = process.env.AI_GATEWAY_API_KEY ?? process.env.VERCEL_OIDC_TOKEN;
  if (!gatewayApiKey) return null;
  return {
    apiKey: gatewayApiKey,
    endpoint: VERCEL_AI_GATEWAY_RESPONSES_URL,
    model: requestedModel.includes("/") ? requestedModel : `openai/${requestedModel}`,
    pricingModel: requestedModel,
    source: "vercel_ai_gateway",
  };
}

function outputTextFromPayload(payload: ResponsesPayload) {
  return payload.output_text
    ?? payload.output?.flatMap((item) => item.content ?? []).find((item) => item.type === "output_text")?.text;
}

function logUsage(usage: VisitCloseUsage) {
  console.info("[visit_close_ai_usage]", usage);
}

function normalizeNote(note: string) {
  const normalized = note.trim().replace(/\s+/g, " ");
  if (!normalized) throw new VisitCloseAiError("invalid_note", "Dictez ou écrivez quelques mots sur la visite.");
  return normalized.slice(0, MAX_VISIT_CLOSE_NOTE_CHARS);
}

export async function analyzeVisitCloseNote(
  note: string,
  fetcher: Fetcher = fetch,
  usageSink: UsageSink = logUsage,
): Promise<VisitCloseDraft> {
  const normalizedNote = normalizeNote(note);
  const provider = resolveProvider();
  if (!provider) {
    throw new VisitCloseAiError("ai_unavailable", "L’assistant IA est indisponible. Vous pouvez clôturer la visite manuellement.");
  }

  const startedAt = Date.now();
  try {
    const normalizedModel = provider.model.startsWith("openai/") ? provider.model.slice("openai/".length) : provider.model;
    const response = await fetcher(provider.endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: provider.model,
        ...(normalizedModel.startsWith("gpt-5.6-") ? { reasoning: { effort: "none" } } : {}),
        store: false,
        max_output_tokens: 260,
        instructions: VISIT_CLOSE_INSTRUCTIONS,
        input: `Date du jour (Europe/Paris): ${todayInParis()}\nNote terrain: ${normalizedNote}`,
        text: {
          format: {
            type: "json_schema",
            name: "visit_close",
            strict: true,
            schema: VISIT_CLOSE_JSON_SCHEMA,
          },
        },
      }),
    });

    if (!response.ok) {
      const responseBody = await response.text().catch(() => "");
      console.error("[visit_close_ai_error] Provider rejected request", {
        provider: provider.source,
        model: provider.model,
        status: response.status,
        response: responseBody.slice(0, 500),
      });
      throw new VisitCloseAiError("ai_unavailable", "L’assistant IA est indisponible. Vous pouvez clôturer la visite manuellement.");
    }

    const payload = await response.json() as ResponsesPayload;
    usageSink({
      model: provider.model,
      inputTokens: validTokenCount(payload.usage?.input_tokens),
      cachedInputTokens: validTokenCount(payload.usage?.input_tokens_details?.cached_tokens),
      outputTokens: validTokenCount(payload.usage?.output_tokens),
      reasoningTokens: validTokenCount(payload.usage?.output_tokens_details?.reasoning_tokens),
      totalTokens: validTokenCount(payload.usage?.total_tokens),
      estimatedCostUsd: estimateVisitCloseCostUsd(provider.pricingModel, payload.usage),
      latencyMs: Math.max(0, Date.now() - startedAt),
    });

    const outputText = outputTextFromPayload(payload);
    if (!outputText) throw new VisitCloseAiError("analysis_failed", "TR1 n’a pas pu structurer cette note.");
    const draft = visitCloseDraft.parse(JSON.parse(outputText));
    if (draft.next === "custom" && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(draft.customNext ?? "")) {
      return { ...draft, next: "none", customNext: null };
    }
    if (draft.next !== "custom" && draft.customNext !== null) {
      return { ...draft, customNext: null };
    }
    return draft;
  } catch (error) {
    if (error instanceof VisitCloseAiError) throw error;
    console.error("[visit_close_ai_error] Unexpected analysis failure", {
      model: provider.model,
      error: error instanceof Error ? error.message : String(error),
    });
    throw new VisitCloseAiError("analysis_failed", "TR1 n’a pas pu structurer cette note. Vous pouvez clôturer manuellement.");
  }
}
