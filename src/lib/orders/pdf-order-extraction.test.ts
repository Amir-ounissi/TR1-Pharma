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

  it("uses a non-persistent file input for PDFs and always deletes the temporary OpenAI file", async () => {
    process.env.OPENAI_API_KEY = "key";
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "file_pdf" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ output_text: JSON.stringify(extracted) }), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(extractPdfOrder(new File(["pdf"], "order.pdf", { type: "application/pdf" }), fetcher)).resolves.toMatchObject({ orderNumber: "PDF-42" });
    const upload = fetcher.mock.calls[0][1].body as FormData;
    expect(upload.get("purpose")).toBe("user_data");
    expect(JSON.parse(fetcher.mock.calls[1][1].body)).toMatchObject({ store: false, input: [expect.objectContaining({ content: expect.arrayContaining([expect.objectContaining({ type: "input_file", file_id: "file_pdf" })]) })] });
    expect(fetcher.mock.calls[2][0]).toBe("https://api.openai.com/v1/files/file_pdf");
    expect(fetcher.mock.calls[2][1]).toMatchObject({ method: "DELETE" });
  });

  it("uses a vision image input for order photos and deletes the temporary file", async () => {
    process.env.OPENAI_API_KEY = "key";
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "file_image" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ output_text: JSON.stringify(extracted) }), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(extractPdfOrder(new File(["jpeg"], "order.jpg", { type: "image/jpeg" }), fetcher)).resolves.toMatchObject({ orderNumber: "PDF-42" });
    const upload = fetcher.mock.calls[0][1].body as FormData;
    expect(upload.get("purpose")).toBe("vision");
    expect(JSON.parse(fetcher.mock.calls[1][1].body)).toMatchObject({ store: false, input: [expect.objectContaining({ content: expect.arrayContaining([expect.objectContaining({ type: "input_image", file_id: "file_image", detail: "original" })]) })] });
    expect(fetcher.mock.calls[2][0]).toBe("https://api.openai.com/v1/files/file_image");
    expect(fetcher.mock.calls[2][1]).toMatchObject({ method: "DELETE" });
  });

  it("returns a controlled error when the API is unavailable and still deletes the uploaded file", async () => {
    process.env.OPENAI_API_KEY = "key";
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "file_123" }), { status: 200 }))
      .mockResolvedValueOnce(new Response("unavailable", { status: 503 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(extractPdfOrder(new File(["pdf"], "order.pdf", { type: "application/pdf" }), fetcher)).rejects.toBeInstanceOf(PdfOrderImportError);
    expect(fetcher).toHaveBeenLastCalledWith("https://api.openai.com/v1/files/file_123", expect.objectContaining({ method: "DELETE" }));
  });
});
