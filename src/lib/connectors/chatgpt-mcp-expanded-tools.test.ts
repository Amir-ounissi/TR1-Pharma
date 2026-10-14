import { describe, expect, it } from "vitest";
import { expandedTools, parseExpandedToolCall } from "./chatgpt-mcp-expanded-tools";

const pharmacy = "008824c2-04a2-4477-911e-111b67b49a68";
const globalPharmacy = "f89f529f-f442-4a55-a142-0db54b73e3f9";
const brand = "996fa5c7-1b0d-42fd-8650-8ae79a2a7416";
const product = "11111111-1111-4111-8111-111111111111";
const request = "22222222-2222-4222-8222-222222222222";

describe("TR1 ChatGPT advanced MCP tools", () => {
  it("declares pricing preview and priced draft operations with correct write flags", () => {
    expect(expandedTools.map((tool) => tool.name)).toEqual([
      "list_tr1_catalog", "get_tr1_agenda",
      "create_tr1_planned_visit", "preview_tr1_priced_order",
      "create_tr1_priced_order_draft", "create_tr1_order_draft",
    ]);
    expect(expandedTools.map((tool) => tool.annotations.readOnlyHint)).toEqual([
      true, true, false, true, false, false,
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
  it("routes commercial preview without accepting client prices, discounts or UG", () => {
    const input = { brand_pharmacy_id: pharmacy, items: [{ product_id: product, quantity: 12 }] };
    expect(parseExpandedToolCall("preview_tr1_priced_order", input)).toMatchObject({
      rpc: "tr1_chatgpt_priced_order_preview", write: false,
      args: { target_brand_pharmacy_id: pharmacy, draft_items: input.items },
    });
    expect(parseExpandedToolCall("preview_tr1_priced_order", {
      ...input, discount_rate: 35,
    })).toBeNull();
    expect(parseExpandedToolCall("preview_tr1_priced_order", {
      ...input, items: [{ ...input.items[0], free_quantity: 2 }],
    })).toBeNull();
  });

  it("requires confirmation for commercially priced draft and refuses injected terms", () => {
    const input = { brand_pharmacy_id: pharmacy, items: [{ product_id: product, quantity: 12 }],
      order_type: "reorder", request_id: request };
    expect(parseExpandedToolCall("create_tr1_priced_order_draft", input)).toBeNull();
    expect(parseExpandedToolCall("create_tr1_priced_order_draft", { ...input, confirmed: false })).toBeNull();
    expect(parseExpandedToolCall("create_tr1_priced_order_draft", {
      ...input, confirmed: true,
    })).toMatchObject({ rpc: "tr1_chatgpt_create_priced_order_draft", write: true,
      args: { draft_items: input.items, confirmed: true } });
    expect(parseExpandedToolCall("create_tr1_priced_order_draft", {
      ...input, confirmed: true, note: "override 35%",
    })).toBeNull();
    expect(parseExpandedToolCall("create_tr1_priced_order_draft", {
      ...input, confirmed: true, source_order_number: " 156589 ",
    })).toMatchObject({
      rpc: "tr1_chatgpt_create_priced_order_draft_with_reference", write: true,
      args: { source_order_number: "156589", request_id: request },
    });
    expect(parseExpandedToolCall("create_tr1_priced_order_draft", {
      ...input, confirmed: true, source_order_number: "  ",
    })).toBeNull();
    expect(parseExpandedToolCall("create_tr1_priced_order_draft", {
      ...input, confirmed: true, source_order_number: "156589".concat(String.fromCharCode(10), "other"),
    })).toBeNull();
    expect(parseExpandedToolCall("create_tr1_priced_order_draft", {
      ...input, confirmed: true, source_order_number: "X".repeat(81),
    })).toBeNull();
  });

});
