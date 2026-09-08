import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_ORDER_EXTRACTION_MODEL,
  estimateOrderScanCostUsd,
  extractPdfOrder,
  PdfOrderImportError,
} from "./pdf-order-extraction";
import { parsePdfOrderExtraction } from "./pdf-order-schema";

const originalApiKey = process.env.OPENAI_API_KEY;
const originalModel = process.env.OPENAI_PDF_ORDER_MODEL;
const extracted = { orderNumber: "PDF-42", orderDate: "2026-09-02", pharmacy: { name: "Pharmacie Centre", siret: null, cip: null, finess: null, address: null, postalCode: "75001" }, lines: [{ label: "Produit", sku: "SKU", ean: null, quantity: 2, unitPriceHt: 10, discountRate: null }], totalHt: 20, totalTtc: null, warnings: [] };

function restoreEnv(name: "OPENAI_API_KEY" | "OPENAI_PDF_ORDER_MODEL", value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

afterEach(() => {
  restoreEnv("OPENAI_API_KEY", originalApiKey);
  restoreEnv("OPENAI_PDF_ORDER_MODEL", originalModel);
  vi.restoreAllMocks();
});

describe("order document extraction", () => {
  it("validates the structured extraction schema", () => {
    expect(parsePdfOrderExtraction(extracted)).toMatchObject({ orderNumber: "PDF-42", lines: [{ quantity: 2 }] });
    expect(() => parsePdfOrderExtraction({ ...extracted, lines: [{ ...extracted.lines[0], quantity: -1 }] })).toThrow();
  });

  it("rejects an unsupported file or a document over 3 MB before any API call", async () => {
    process.env.OPENAI_API_KEY = "key";
    const fetcher = vi.fn();
    await expect(extractPdfOrder(new File(["x"], "order.txt", { type: "text/plain" }), fetcher)).rejects.toMatchObject({ code: "invalid_file" });
    await expect(extractPdfOrder(new File([new Uint8Array(3 * 1024 * 1024 + 1)], "order.pdf", { type: "application/pdf" }), fetcher)).rejects.toMatchObject({ code: "invalid_file" });
    await expect(extractPdfOrder(new File([new Uint8Array(3 * 1024 * 1024 + 1)], "order.jpg", { type: "image/jpeg" }), fetcher)).rejects.toMatchObject({ code: "invalid_file" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("uses GPT-5 Mini with minimal reasoning and records exact API usage", async () => {
    process.env.OPENAI_API_KEY = "key";
    delete process.env.OPENAI_PDF_ORDER_MODEL;
    const usageSink = vi.fn();
    const fetcher = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({
      output_text: JSON.stringify(extracted),
      usage: {
        input_tokens: 1_000,
        input_tokens_details: { cached_tokens: 200 },
        output_tokens: 500,
        output_tokens_details: { reasoning_tokens: 100 },
        total_tokens: 1_500,
      },
    }), { status: 200 }));

    await expect(extractPdfOrder(new File(["pdf"], "order.pdf", { type: "application/pdf" }), fetcher, usageSink)).resolves.toMatchObject({ orderNumber: "PDF-42" });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][0]).toBe("https://api.openai.com/v1/responses");
    const body = JSON.parse(fetcher.mock.calls[0][1].body);
    expect(body).toMatchObject({
      model: DEFAULT_ORDER_EXTRACTION_MODEL,
      reasoning: { effort: "minimal" },
      store: false,
      input: [expect.objectContaining({
        content: expect.arrayContaining([
          expect.objectContaining({ type: "input_file", filename: "order.pdf" }),
        ]),
      })],
    });
    const fileInput = body.input[0].content.find((item: { type: string }) => item.type === "input_file");
    expect(fileInput.file_data).toBe(Buffer.from("pdf").toString("base64"));

    expect(usageSink).toHaveBeenCalledTimes(1);
    expect(usageSink).toHaveBeenCalledWith(expect.objectContaining({
      model: "gpt-5-mini",
      inputTokens: 1_000,
      cachedInputTokens: 200,
      outputTokens: 500,
      reasoningTokens: 100,
      totalTokens: 1_500,
      estimatedCostUsd: 0.001205,
      mimeType: "application/pdf",
      fileSizeBytes: 3,
      latencyMs: expect.any(Number),
    }));
    expect(JSON.stringify(usageSink.mock.calls[0][0])).not.toContain("Pharmacie Centre");
    expect(JSON.stringify(usageSink.mock.calls[0][0])).not.toContain("PDF-42");
  });

  it("does not double-count reasoning tokens in the estimated output cost", () => {
    expect(estimateOrderScanCostUsd("gpt-5-mini", {
      input_tokens: 0,
      output_tokens: 1_000,
      output_tokens_details: { reasoning_tokens: 800 },
    })).toBe(0.002);
  });

  it("keeps an explicit model override and applies a safe reasoning floor for GPT-5", async () => {
    process.env.OPENAI_API_KEY = "key";
    process.env.OPENAI_PDF_ORDER_MODEL = "gpt-5";
    const usageSink = vi.fn();
    const fetcher = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ output_text: JSON.stringify(extracted) }), { status: 200 }));

    await extractPdfOrder(new File(["pdf"], "order.pdf", { type: "application/pdf" }), fetcher, usageSink);
    const body = JSON.parse(fetcher.mock.calls[0][1].body);
    expect(body).toMatchObject({ model: "gpt-5", reasoning: { effort: "minimal" } });
    expect(usageSink).toHaveBeenCalledWith(expect.objectContaining({ model: "gpt-5", estimatedCostUsd: null }));
  });

  it("omits unsupported reasoning configuration and unknown pricing for custom model overrides", async () => {
    process.env.OPENAI_API_KEY = "key";
    process.env.OPENAI_PDF_ORDER_MODEL = "custom-model";
    const usageSink = vi.fn();
    const fetcher = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({
      output_text: JSON.stringify(extracted),
      usage: { input_tokens: 100, output_tokens: 50, total_tokens: 150 },
    }), { status: 200 }));

    await extractPdfOrder(new File(["pdf"], "order.pdf", { type: "application/pdf" }), fetcher, usageSink);
    const body = JSON.parse(fetcher.mock.calls[0][1].body);
    expect(body.model).toBe("custom-model");
    expect(body.reasoning).toBeUndefined();
    expect(usageSink).toHaveBeenCalledWith(expect.objectContaining({ estimatedCostUsd: null }));
  });

  it("sends order photos inline as high-detail data URLs", async () => {
    process.env.OPENAI_API_KEY = "key";
    delete process.env.OPENAI_PDF_ORDER_MODEL;
    const usageSink = vi.fn();
    const fetcher = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ output_text: JSON.stringify(extracted) }), { status: 200 }));
    await expect(extractPdfOrder(new File(["jpeg"], "order.jpg", { type: "image/jpeg" }), fetcher, usageSink)).resolves.toMatchObject({ orderNumber: "PDF-42" });
    expect(fetcher).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetcher.mock.calls[0][1].body);
    const imageInput = body.input[0].content.find((item: { type: string }) => item.type === "input_image");
    expect(imageInput).toMatchObject({ type: "input_image", detail: "high" });
    expect(imageInput.image_url).toBe(`data:image/jpeg;base64,${Buffer.from("jpeg").toString("base64")}`);
  });

  it("returns a controlled error when the Responses API is unavailable", async () => {
    process.env.OPENAI_API_KEY = "key";
    const fetcher = vi.fn().mockResolvedValueOnce(new Response("unavailable", { status: 503 }));
    await expect(extractPdfOrder(new File(["pdf"], "order.pdf", { type: "application/pdf" }), fetcher)).rejects.toBeInstanceOf(PdfOrderImportError);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
