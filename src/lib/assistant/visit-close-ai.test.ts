import { afterEach, describe, expect, it, vi } from "vitest";
import {
  analyzeVisitCloseNote,
  DEFAULT_VISIT_CLOSE_MODEL,
  estimateVisitCloseCostUsd,
} from "./visit-close-ai";

const originalApiKey = process.env.OPENAI_API_KEY;
const originalPreviewKey = process.env.OPEN_API_PREVIEW_KEY;
const originalGatewayKey = process.env.AI_GATEWAY_API_KEY;
const originalOidcToken = process.env.VERCEL_OIDC_TOKEN;
const originalModel = process.env.OPENAI_VISIT_CLOSE_MODEL;

function restoreEnv(
  name:
    | "OPENAI_API_KEY"
    | "OPEN_API_PREVIEW_KEY"
    | "AI_GATEWAY_API_KEY"
    | "VERCEL_OIDC_TOKEN"
    | "OPENAI_VISIT_CLOSE_MODEL",
  value: string | undefined,
) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

const draft = {
  summary: "Commande obtenue. Sommeil à revoir car stock concurrent.",
  outcome: "very_good",
  next: "weeks2",
  customNext: null,
  tags: ["order", "competitor", "callback"],
};

afterEach(() => {
  restoreEnv("OPENAI_API_KEY", originalApiKey);
  restoreEnv("OPEN_API_PREVIEW_KEY", originalPreviewKey);
  restoreEnv("AI_GATEWAY_API_KEY", originalGatewayKey);
  restoreEnv("VERCEL_OIDC_TOKEN", originalOidcToken);
  restoreEnv("OPENAI_VISIT_CLOSE_MODEL", originalModel);
  vi.restoreAllMocks();
});

describe("visit close AI", () => {
  it("uses Luna with no reasoning, compact structured output, and records usage", async () => {
    process.env.OPENAI_API_KEY = "key";
    delete process.env.OPENAI_VISIT_CLOSE_MODEL;
    const usageSink = vi.fn();
    const fetcher = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          output_text: JSON.stringify(draft),
          usage: {
            input_tokens: 600,
            input_tokens_details: { cached_tokens: 100 },
            output_tokens: 120,
            output_tokens_details: { reasoning_tokens: 0 },
            total_tokens: 720,
          },
        }),
        { status: 200 },
      ),
    );

    await expect(
      analyzeVisitCloseNote(
        "Commande 12 unités. Sommeil à revoir car stock concurrent. Rappeler dans 2 semaines.",
        fetcher,
        usageSink,
      ),
    ).resolves.toEqual(draft);

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][0]).toBe("https://api.openai.com/v1/responses");
    const body = JSON.parse(fetcher.mock.calls[0][1].body);
    expect(body).toMatchObject({
      model: DEFAULT_VISIT_CLOSE_MODEL,
      reasoning: { effort: "none" },
      store: false,
      max_output_tokens: 260,
      text: {
        format: {
          type: "json_schema",
          name: "visit_close",
          strict: true,
        },
      },
    });
    expect(body.input).toContain("Commande 12 unités");
    expect(body.input).not.toContain("historique complet");
    expect(body.input).not.toContain("chiffre d’affaires");

    expect(usageSink).toHaveBeenCalledTimes(1);
    expect(usageSink).toHaveBeenCalledWith(
      expect.objectContaining({
        model: DEFAULT_VISIT_CLOSE_MODEL,
        inputTokens: 600,
        cachedInputTokens: 100,
        outputTokens: 120,
        reasoningTokens: 0,
        totalTokens: 720,
        estimatedCostUsd: 0.000246,
        latencyMs: expect.any(Number),
      }),
    );
    expect(JSON.stringify(usageSink.mock.calls[0][0])).not.toContain("Commande 12 unités");
  });

  it("rejects an empty note before spending any tokens", async () => {
    process.env.OPENAI_API_KEY = "key";
    const fetcher = vi.fn();
    await expect(analyzeVisitCloseNote("   ", fetcher)).rejects.toMatchObject({ code: "invalid_note" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("caps the qualitative note sent to the model", async () => {
    process.env.OPENAI_API_KEY = "key";
    const fetcher = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ output_text: JSON.stringify(draft) }), { status: 200 }),
    );
    await analyzeVisitCloseNote(`Début ${"x".repeat(3_000)}`, fetcher);
    const body = JSON.parse(fetcher.mock.calls[0][1].body);
    expect(body.input.length).toBeLessThan(2_100);
  });

  it("falls back to Vercel AI Gateway without an OpenAI key", async () => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPEN_API_PREVIEW_KEY;
    delete process.env.AI_GATEWAY_API_KEY;
    process.env.VERCEL_OIDC_TOKEN = "oidc-token";
    delete process.env.OPENAI_VISIT_CLOSE_MODEL;
    const fetcher = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ output_text: JSON.stringify(draft) }), { status: 200 }),
    );

    await analyzeVisitCloseNote("Visite positive, commande prise.", fetcher);
    expect(fetcher.mock.calls[0][0]).toBe("https://ai-gateway.vercel.sh/v1/responses");
    expect(fetcher.mock.calls[0][1].headers.Authorization).toBe("Bearer oidc-token");
    const body = JSON.parse(fetcher.mock.calls[0][1].body);
    expect(body).toMatchObject({
      model: `openai/${DEFAULT_VISIT_CLOSE_MODEL}`,
      reasoning: { effort: "none" },
    });
  });

  it("discards an invalid custom follow-up rather than inventing a date", async () => {
    process.env.OPENAI_API_KEY = "key";
    const fetcher = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          output_text: JSON.stringify({
            ...draft,
            next: "custom",
            customNext: "octobre prochain",
          }),
        }),
        { status: 200 },
      ),
    );

    await expect(analyzeVisitCloseNote("Revoir la pharmacie plus tard.", fetcher)).resolves.toMatchObject({
      next: "none",
      customNext: null,
    });
  });

  it("estimates Luna cost without double-counting reasoning tokens", () => {
    expect(
      estimateVisitCloseCostUsd("gpt-5.6-luna", {
        input_tokens: 600,
        input_tokens_details: { cached_tokens: 100 },
        output_tokens: 120,
        output_tokens_details: { reasoning_tokens: 90 },
      }),
    ).toBe(0.000246);
  });
});
