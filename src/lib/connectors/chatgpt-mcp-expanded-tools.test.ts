import { describe, expect, it } from "vitest";
import { expandedTools, parseExpandedToolCall } from "./chatgpt-mcp-expanded-tools";

const pharmacy = "008824c2-04a2-4477-911e-111b67b49a68";
const globalPharmacy = "f89f529f-f442-4a55-a142-0db54b73e3f9";
const brand = "996fa5c7-1b0d-42fd-8650-8ae79a2a7416";
const product = "11111111-1111-4111-8111-111111111111";
const request = "22222222-2222-4222-8222-222222222222";

describe("TR1 ChatGPT advanced MCP tools", () => {
  it("declares four distinct operations and marks writes as writes", () => {
    expect(expandedTools.map((tool) => tool.name)).toEqual([
      "list_tr1_catalog", "get_tr1_agenda",
      "create_tr1_planned_visit", "create_tr1_order_draft",
    ]);
    expect(expandedTools.map((tool) => tool.annotations.readOnlyHint)).toEqual([
      true, true, false, false,
    ]);
  });

  it("allows catalog lookup without write access", () => {
    const parsed = parseExpandedToolCall("list_tr1_catalog", { brand_id: brand, q: "Safran" });
    expect(parsed).toMatchObject({
      rpc: "tr1_chatgpt_catalog", write: false,
      args: { target_brand_id: brand, search_text: "Safran" },
    });
  });

  it("rejects unknown tools and malformed agenda ranges", () => {
    expect(parseExpandedToolCall("erase_database", {})).toBeNull();
    expect(parseExpandedToolCall("get_tr1_agenda", {
      start_date: "2026-10-15", end_date: "2026-10-10",
    })).toBeNull();
    expect(parseExpandedToolCall("get_tr1_agenda", {
      start_date: "tomorrow", end_date: "2026-10-15",
    })).toBeNull();
  });

  it("requires explicit confirmation and timezone offsets for visits", () => {
    const visit = {
      pharmacy_id: globalPharmacy, brand_pharmacy_ids: [pharmacy],
      visit_kind: "client_visit", title: "RDV pharmacie",
      start_at: "2026-10-15T10:00:00+02:00", end_at: "2026-10-15T10:30:00+02:00",
    };
    expect(parseExpandedToolCall("create_tr1_planned_visit", visit)).toBeNull();
    expect(parseExpandedToolCall("create_tr1_planned_visit", { ...visit, confirmed: false })).toBeNull();
    expect(parseExpandedToolCall("create_tr1_planned_visit", {
      ...visit, confirmed: true, start_at: "2026-10-15T10:00:00",
    })).toBeNull();
    expect(parseExpandedToolCall("create_tr1_planned_visit", { ...visit, confirmed: true }))
      .toMatchObject({ write: true, rpc: "tr1_chatgpt_create_planned_visit" });
  });

  it("rejects duplicate order items or unconfirmed drafts", () => {
    const draft = {
      brand_pharmacy_id: pharmacy, order_type: "reorder", request_id: request,
      items: [{ product_id: product, quantity: 24 }],
    };
    expect(parseExpandedToolCall("create_tr1_order_draft", draft)).toBeNull();
    expect(parseExpandedToolCall("create_tr1_order_draft", { ...draft, confirmed: false })).toBeNull();
    expect(parseExpandedToolCall("create_tr1_order_draft", {
      ...draft, confirmed: true, items: [draft.items[0], draft.items[0]],
    })).toBeNull();
    expect(parseExpandedToolCall("create_tr1_order_draft", {
      ...draft, confirmed: true, items: [{ product_id: product, quantity: 0 }],
    })).toBeNull();
  });

  it("passes only approved draft inputs to the database", () => {
    const parsed = parseExpandedToolCall("create_tr1_order_draft", {
      brand_pharmacy_id: pharmacy, order_type: "reorder", request_id: request,
      items: [{ product_id: product, quantity: 24 }], note: "Réassort",
      confirmed: true,
    });
    expect(parsed).toMatchObject({
      rpc: "tr1_chatgpt_create_order_draft", write: true,
      args: { target_brand_pharmacy_id: pharmacy,
        draft_items: [{ product_id: product, quantity: 24 }],
        confirmed: true, request_id: request },
    });
  });
});
