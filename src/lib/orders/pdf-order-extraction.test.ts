import { afterEach, describe, expect, it, vi } from "vitest";
import { extractPdfOrder, PdfOrderImportError } from "./pdf-order-extraction";
import { parsePdfOrderExtraction } from "./pdf-order-schema";

const originalApiKey = process.env.OPENAI_API_KEY;
const extracted = { orderNumber: "PDF-42", orderDate: "2026-09-02", pharmacy: { name: "Pharmacie Centre", siret: null, cip: null, finess: null, address: null, postalCode: "75001" }, lines: [{ label: "Produit", sku: "SKU", ean: null, quantity: 2, unitPriceHt: 10, discountRate: null }], totalHt: 20, totalTtc: null, warnings: [] };

afterEach(() => { process.env.OPENAI_API_KEY = originalApiKey; });

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

  it("sends PDFs inline to Responses without upload/delete round trips", async () => {
    process.env.OPENAI_API_KEY = "key";
    const fetcher = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ output_text: JSON.stringify(extracted) }), { status: 200 }));
    await expect(extractPdfOrder(new File(["pdf"], "order.pdf", { type: "application/pdf" }), fetcher)).resolves.toMatchObject({ orderNumber: "PDF-42" });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][0]).toBe("https://api.openai.com/v1/responses");
    const body = JSON.parse(fetcher.mock.calls[0][1].body);
    expect(body).toMatchObject({
      model: "gpt-5",
      store: false,
      input: [expect.objectContaining({
        content: expect.arrayContaining([
          expect.objectContaining({ type: "input_file", filename: "order.pdf" }),
        ]),
      })],
    });
    const fileInput = body.input[0].content.find((item: { type: string }) => item.type === "input_file");
    expect(fileInput.file_data).toBe(Buffer.from("pdf").toString("base64"));
  });

  it("sends order photos inline as high-detail data URLs", async () => {
    process.env.OPENAI_API_KEY = "key";
    const fetcher = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ output_text: JSON.stringify(extracted) }), { status: 200 }));
    await expect(extractPdfOrder(new File(["jpeg"], "order.jpg", { type: "image/jpeg" }), fetcher)).resolves.toMatchObject({ orderNumber: "PDF-42" });
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
