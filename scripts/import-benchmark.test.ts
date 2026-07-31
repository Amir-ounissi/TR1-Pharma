import { performance } from "node:perf_hooks";
import { describe, expect, it } from "vitest";

import { previewImport } from "../src/lib/imports/import-engine";

describe("Sprint 11 import load benchmark", () => {
  it("parses, maps and validates 5,000 product rows", () => {
    const rows = Array.from(
      { length: 5_000 },
      (_, index) => `BENCH-${index + 1};Produit ${index + 1};Benchmark;oui;19,90;;non`,
    );
    const csv = [
      "product_code;product_name;category;active;unit_price_ht;ean;strategic",
      ...rows,
    ].join("\n");

    const startedAt = performance.now();
    const preview = previewImport({ content: csv, type: "products" });
    const durationMs = performance.now() - startedAt;

    console.info(`SPRINT11_IMPORT_PREVIEW rows=5000 duration_ms=${durationMs.toFixed(2)}`);
    expect(preview.summary).toMatchObject({ total: 5_000, valid: 5_000, errors: 0 });
    expect(durationMs).toBeLessThan(10_000);
  });
});
