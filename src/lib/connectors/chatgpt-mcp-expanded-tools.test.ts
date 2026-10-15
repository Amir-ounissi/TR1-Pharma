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
      "preview_tr1_ug_adjustments", "set_tr1_priced_order_ug_adjustments",
      "create_tr1_priced_order_draft", "review_tr1_priced_order",
      "submit_tr1_priced_order_to_hubspot", "create_tr1_order_draft",
      "preview_tr1_black_friday_preorder", "create_tr1_black_friday_preorder_draft",
      "review_tr1_black_friday_preorder", "submit_tr1_black_friday_preorder_to_hubspot",
    ]);
    expect(expandedTools.map((tool) => tool.annotations.readOnlyHint)).toEqual([
      true, true, false, true, true, false, false, true, false, false,
    ]);
  });

  it("requires review token and explicit confirmation to submit a priced order", () => {
    const args = {
      order_id: "55555555-5555-4555-8555-555555555555",
      request_id: request,
      review_token: "a".repeat(32),
    };
    expect(parseExpandedToolCall("review_tr1_priced_order", {
      order_id: args.order_id, request_id: request,
    })).toMatchObject({ rpc: "tr1_chatgpt_review_priced_order", write: false });
    expect(parseExpandedToolCall("submit_tr1_priced_order_to_hubspot", args)).toBeNull();
    expect(parseExpandedToolCall("submit_tr1_priced_order_to_hubspot", {
      ...args, confirmed: false,
    })).toBeNull();
    expect(parseExpandedToolCall("submit_tr1_priced_order_to_hubspot", {
      ...args, review_token: "invalid", confirmed: true,
    })).toBeNull();
    expect(parseExpandedToolCall("submit_tr1_priced_order_to_hubspot", {
      ...args, confirmed: true,
    })).toMatchObject({
      rpc: "tr1_chatgpt_submit_priced_order",
      write: true, args: { confirmed: true, request_id: request },
    });
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


  it("previews per-order add and replace UG, rejecting unsafe overrides", () => {
    const p2 = "33333333-3333-4333-8333-333333333333";
    const items = [{ product_id: product, quantity: 24 }, { product_id: p2, quantity: 24 }];
    const adjustments = [
      { product_id: product, mode: "replace", quantity: 24,
        classification: "offre exceptionnelle sell-in" },
      { product_id: p2, mode: "add", quantity: 17,
        classification: "compensation opé promo" },
    ];
    expect(parseExpandedToolCall("preview_tr1_ug_adjustments", {
      brand_pharmacy_id: pharmacy, items, adjustments,
    })).toMatchObject({
      rpc: "tr1_chatgpt_ug_adjusted_preview", write: false,
      args: { adjustments },
    });
    const base = { brand_pharmacy_id: pharmacy, items, adjustments };
    expect(parseExpandedToolCall("preview_tr1_ug_adjustments", {
      ...base, adjustments: [{ ...adjustments[0], quantity: -1 }],
    })).toBeNull();
    expect(parseExpandedToolCall("preview_tr1_ug_adjustments", {
      ...base, adjustments: [{ ...adjustments[1], mode: "add", quantity: 0 }],
    })).toBeNull();
    expect(parseExpandedToolCall("preview_tr1_ug_adjustments", {
      ...base, adjustments: [{ ...adjustments[0], discount_rate: 10 }],
    })).toBeNull();
    expect(parseExpandedToolCall("preview_tr1_ug_adjustments", {
      ...base, adjustments: [adjustments[0], adjustments[0]],
    })).toBeNull();
    expect(parseExpandedToolCall("preview_tr1_ug_adjustments", {
      ...base, adjustments: [{ ...adjustments[0], classification: "unknown" }],
    })).toBeNull();
  });

  it("requires explicit confirmation for UG draft changes and supports zero replacement", () => {
    const adjustments = [{
      product_id: product, mode: "replace", quantity: 0,
      classification: "geste commercial",
    }];
    const input = { order_id: pharmacy, request_id: request, adjustments };
    expect(parseExpandedToolCall("set_tr1_priced_order_ug_adjustments", input)).toBeNull();
    expect(parseExpandedToolCall("set_tr1_priced_order_ug_adjustments", {
      ...input, confirmed: false,
    })).toBeNull();
    expect(parseExpandedToolCall("set_tr1_priced_order_ug_adjustments", {
      ...input, confirmed: true,
    })).toMatchObject({
      rpc: "tr1_chatgpt_set_draft_ug_adjustments", write: true,
      args: { confirmed: true, adjustments },
    });
    expect(parseExpandedToolCall("set_tr1_priced_order_ug_adjustments", {
      ...input, adjustments: [], confirmed: true,
    })).toMatchObject({
      rpc: "tr1_chatgpt_set_draft_ug_adjustments", write: true,
      args: { adjustments: [] },
    });
  });

  it("accepts the Praden Black Friday preorder in a restricted preview, with 20 explicit UG", () => {
    const items = [
      { product_id: product, quantity: 48, free_quantity: 6 },
      { product_id: "33333333-3333-4333-8333-333333333333", quantity: 48, free_quantity: 6 },
      { product_id: "44444444-4444-4444-8444-444444444444", quantity: 48, free_quantity: 6 },
      { product_id: "55555555-5555-4555-8555-555555555555", quantity: 12, free_quantity: 2 },
    ];
    expect(parseExpandedToolCall("preview_tr1_black_friday_preorder", {
      brand_pharmacy_id: pharmacy, items,
    })).toMatchObject({
      rpc: "tr1_chatgpt_trade_preorder_preview", write: false,
      args: { draft_items: items },
    });
    expect(parseExpandedToolCall("preview_tr1_black_friday_preorder", {
      brand_pharmacy_id: pharmacy, items: items.map(i => ({ ...i, discount_rate: 40 })),
    })).toBeNull();
    expect(parseExpandedToolCall("preview_tr1_black_friday_preorder", {
      brand_pharmacy_id: pharmacy, items: [items[0], items[0]],
    })).toBeNull();
    expect(parseExpandedToolCall("preview_tr1_black_friday_preorder", {
      brand_pharmacy_id: pharmacy, items: [{ ...items[0], free_quantity: 5 }],
    })).toBeNull();
  });

  it("requires a distinct confirmed trade draft then a reviewed trade submission", () => {
    const input = { brand_pharmacy_id: pharmacy,
      items: [{ product_id: product, quantity: 12, free_quantity: 2 }],
      source_order_number: "BF-2026-100",
      request_id: request,
    };
    expect(parseExpandedToolCall("create_tr1_black_friday_preorder_draft", input)).toBeNull();
    expect(parseExpandedToolCall("create_tr1_black_friday_preorder_draft", {
      ...input, confirmed: false,
    })).toBeNull();
    expect(parseExpandedToolCall("create_tr1_black_friday_preorder_draft", {
      ...input, confirmed: true,
    })).toMatchObject({
      rpc: "tr1_chatgpt_create_trade_preorder_draft", write: true,
      args: { source_order_number: "BF-2026-100", draft_items: input.items, confirmed: true },
    });
    expect(parseExpandedToolCall("review_tr1_black_friday_preorder", {
      order_id: pharmacy, request_id: request,
    })).toMatchObject({ rpc: "tr1_chatgpt_review_trade_preorder", write: false });
    const submit = { order_id: pharmacy, request_id: request, review_token: "a".repeat(32) };
    expect(parseExpandedToolCall("submit_tr1_black_friday_preorder_to_hubspot", submit)).toBeNull();
    expect(parseExpandedToolCall("submit_tr1_black_friday_preorder_to_hubspot", {
      ...submit, confirmed: true,
    })).toMatchObject({ rpc: "tr1_chatgpt_submit_trade_preorder", write: true });
  });

});
