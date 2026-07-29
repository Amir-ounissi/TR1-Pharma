import { describe, expect, it } from "vitest";
import { buildDeduplicationKey } from "./import-deduplication";
import { assertExecutable, buildExecutionPlan } from "./import-executor";
import { previewImport } from "./import-engine";
import { autoMapColumns, mergeManualMapping, missingRequiredColumns, normalizeColumnName } from "./import-mapper";
import { normalizeAmount, normalizeBoolean, normalizeEmail, normalizeIsoDate, normalizePhone } from "./import-normalizer";
import { detectDelimiter, parseImportCsv } from "./import-parser";
import { createImportReport, reportToCsv } from "./import-report";
import { neutralizeSpreadsheetFormula, recordsToCsv } from "./control-export";

const productsCsv = [
  "product_code;product_name;category;active;unit_price_ht;ean;strategic",
  "SKU-1;Sérum A;Soin;oui;12,50;3400000000012;non",
].join("\n");

const pharmaciesCsv = [
  "external_id,pharmacy_name,address_line_1,postal_code,city,country,phone,email",
  "PHA-1,Pharmacie République,1 rue A,75001,Paris,FR,+33102030405,CONTACT@EXAMPLE.FR",
].join("\n");

describe("Sprint 11 import engine", () => {
  it("detects semicolon CSV", () => expect(detectDelimiter(productsCsv.split("\n")[0])).toBe(";"));
  it("detects comma CSV", () => expect(detectDelimiter(pharmaciesCsv.split("\n")[0])).toBe(","));
  it("parses quoted separators and line breaks", () => {
    const parsed = parseImportCsv('a,b\n"x,y","ligne 1\nligne 2"');
    expect(parsed.rows[0].raw).toEqual({ a: "x,y", b: "ligne 1\nligne 2" });
  });
  it("removes an UTF-8 BOM", () => expect(parseImportCsv("\uFEFFa;b\n1;2").headers).toEqual(["a", "b"]));
  it("rejects invalid UTF-8 replacement characters", () => expect(() => parseImportCsv("a\n\uFFFD")).toThrow("UTF-8"));
  it("rejects an unclosed quoted field", () => expect(() => parseImportCsv('a;b\n"x;y')).toThrow("non fermé"));
  it("rejects duplicate headers", () => expect(() => parseImportCsv("a;A\n1;2")).toThrow("uniques"));
  it("rejects empty headers", () => expect(() => parseImportCsv("a;;c\n1;2;3")).toThrow("en-tête"));
  it("rejects rows wider than the header", () => expect(() => parseImportCsv("a;b\n1;2;3")).toThrow("trop de colonnes"));
  it("enforces file byte limits", () => expect(() => parseImportCsv("a\n1234", { maxBytes: 3, maxRows: 10, maxFieldLength: 10 })).toThrow("taille"));
  it("enforces row limits", () => expect(() => parseImportCsv("a\n1\n2", { maxBytes: 100, maxRows: 1, maxFieldLength: 10 })).toThrow("1 lignes"));
  it("enforces field limits", () => expect(() => parseImportCsv("a\n1234", { maxBytes: 100, maxRows: 10, maxFieldLength: 3 })).toThrow("longueur"));

  it("normalizes accented column names", () => expect(normalizeColumnName("  Nom Produit  ")).toBe("nom_produit"));
  it("automatically maps aliases", () => expect(autoMapColumns(["sku", "nom_produit", "category", "active"], "products")).toEqual({
    sku: "product_code",
    nom_produit: "product_name",
    category: "category",
    active: "active",
  }));
  it("applies manual mapping and ignored columns", () => expect(mergeManualMapping({ Code: null, Nom: null }, { Code: "product_code", Nom: null })).toEqual({ Code: "product_code", Nom: null }));
  it("reports missing required mappings", () => expect(missingRequiredColumns({ sku: "product_code" }, "products")).toEqual(["product_name", "category", "active"]));

  it.each([
    ["oui", true], ["yes", true], ["1", true], ["non", false], ["0", false], ["inconnu", null],
  ])("normalizes boolean %s", (value, expected) => expect(normalizeBoolean(value)).toBe(expected));
  it("normalizes decimal commas without guessing thousands", () => {
    expect(normalizeAmount("12,50")).toBe(12.5);
    expect(normalizeAmount("1,234,50")).toBeNull();
  });
  it("accepts valid ISO dates and rejects impossible dates", () => {
    expect(normalizeIsoDate("2026-02-28")).toBe("2026-02-28");
    expect(normalizeIsoDate("2026-02-30")).toBeNull();
  });
  it("requires an explicit ambiguous date format", () => {
    expect(normalizeIsoDate("01/02/2026")).toBeNull();
    expect(normalizeIsoDate("01/02/2026", "DMY")).toBe("2026-02-01");
    expect(normalizeIsoDate("01/02/2026", "MDY")).toBe("2026-01-02");
  });
  it("normalizes e-mail and phone", () => {
    expect(normalizeEmail(" CONTACT@Example.FR ")).toBe("contact@example.fr");
    expect(normalizePhone("+33 (1) 02-03-04-05")).toBe("+33102030405");
    expect(normalizeEmail("patient")).toBeNull();
  });

  it("previews and normalizes a product import", () => {
    const preview = previewImport({ content: productsCsv, type: "products" });
    expect(preview.summary).toEqual({ total: 1, valid: 1, warnings: 0, errors: 0, duplicates: 0 });
    expect(preview.rows[0].normalized).toMatchObject({ product_code: "SKU-1", active: true, unit_price_ht: 12.5, strategic: false });
  });
  it("previews and normalizes a pharmacy import", () => {
    const preview = previewImport({ content: pharmaciesCsv, type: "pharmacies" });
    expect(preview.rows[0].normalized).toMatchObject({ country: "FR", email: "contact@example.fr", phone: "+33102030405" });
  });
  it("blocks a product without code", () => {
    const preview = previewImport({ content: productsCsv.replace("SKU-1", ""), type: "products" });
    expect(preview.summary.errors).toBe(1);
  });
  it("blocks a pharmacy without city", () => {
    const preview = previewImport({ content: pharmaciesCsv.replace(",Paris,FR", ",,FR"), type: "pharmacies" });
    expect(preview.rows[0].issues).toContainEqual(expect.objectContaining({ column: "city", severity: "error" }));
  });
  it("blocks invalid order status and fractional quantity", () => {
    const csv = "external_order_id;pharmacy_external_id;order_date;status;total_ht;currency;product_code;quantity\nO-1;P-1;2026-01-02;unknown;20;EUR;SKU-1;1,5";
    const preview = previewImport({ content: csv, type: "orders" });
    expect(preview.rows[0].issues.map((issue) => issue.column)).toEqual(expect.arrayContaining(["status", "quantity"]));
  });
  it("blocks elevated user roles", () => {
    const csv = "email;first_name;last_name;role;active\nadmin@example.fr;A;B;super_admin;oui";
    expect(previewImport({ content: csv, type: "users" }).summary.errors).toBe(1);
  });
  it("blocks invalid ISO country and currency codes", () => {
    const csv = "external_order_id;pharmacy_external_id;order_date;status;total_ht;currency;product_code;quantity\nO-1;P-1;2026-01-02;invoiced;20;EU;SKU-1;1";
    expect(previewImport({ content: csv, type: "orders" }).rows[0].issues).toContainEqual(expect.objectContaining({ column: "currency" }));
  });
  it("detects product duplicates by normalized code", () => {
    const preview = previewImport({ content: `${productsCsv}\n sku-1 ;Autre;Soin;oui;10;;non`, type: "products" });
    expect(preview.summary.duplicates).toBe(2);
  });
  it("detects pharmacies by external id or normalized address", () => {
    const first = previewImport({ content: pharmaciesCsv, type: "pharmacies" }).rows[0];
    expect(buildDeduplicationKey("pharmacies", first)).toBe("pharmacy:pha-1");
    const withoutExternal = { ...first, normalized: { ...first.normalized, external_id: null } };
    expect(buildDeduplicationKey("pharmacies", withoutExternal)).toContain("pharmacy-address:");
  });
  it("detects order, user and territory stable keys", () => {
    const base = { lineNumber: 2, raw: {}, normalized: {}, status: "valid" as const, issues: [], deduplicationKey: null };
    expect(buildDeduplicationKey("orders", { ...base, normalized: { external_order_id: "O-1" } })).toBe("order:o-1");
    expect(buildDeduplicationKey("users", { ...base, normalized: { email: "A@B.FR" } })).toBe("user:a@b.fr");
    expect(buildDeduplicationKey("territories", { ...base, normalized: { territory_code: "IDF" } })).toBe("territory:idf");
  });

  it("builds create-only and upsert plans", () => {
    const preview = previewImport({ content: `${productsCsv}\nSKU-1;Autre;Soin;oui;10;;non`, type: "products" });
    expect(buildExecutionPlan(preview, "create_only")).toMatchObject({ creates: 0, ignored: 2, blocked: 0, executable: true });
    expect(buildExecutionPlan(preview, "upsert")).toMatchObject({ creates: 0, updates: 2, executable: true });
  });
  it("blocks execution when one row is invalid", () => {
    const preview = previewImport({ content: productsCsv.replace("SKU-1", ""), type: "products" });
    const plan = buildExecutionPlan(preview, "create_only");
    expect(plan.executable).toBe(false);
    expect(() => assertExecutable(plan)).toThrow("invalides");
  });
  it("creates a deterministic report and CSV", () => {
    const preview = previewImport({ content: productsCsv, type: "products" });
    const report = createImportReport(preview, buildExecutionPlan(preview, "create_only"), "2026-07-28T00:00:00.000Z");
    expect(report).toMatchObject({ created: 1, status: "ready", generatedAt: "2026-07-28T00:00:00.000Z" });
    expect(reportToCsv(report)).toContain("products;1;1;0;0;0;0;ready");
  });
  it("escapes control exports safely", () => {
    expect(recordsToCsv([{ name: 'Pharmacie "Centre"', city: "Paris; 1" }])).toBe('"name";"city"\n"Pharmacie ""Centre""";"Paris; 1"');
  });
  it.each(["=1+1", "+cmd", "-2+3", "@SUM(A1:A2)", "  =HYPERLINK(\"x\")"])(
    "neutralizes spreadsheet formula %s",
    (value) => expect(neutralizeSpreadsheetFormula(value)).toBe(`'${value}`),
  );
  it("keeps ordinary exported values unchanged", () => {
    expect(recordsToCsv([{ name: "Pharmacie Centre", amount: 12.5 }])).toBe('"name";"amount"\n"Pharmacie Centre";"12.5"');
  });
});
