import { describe, expect, it, vi } from "vitest";
import { createAssistantActions } from "./assistant-actions";

function client(results: Record<string, unknown>) {
  return {
    rpc: vi.fn().mockImplementation((name: string) => Promise.resolve({
      data: results[name] ?? null,
      error: null,
    })),
    from: vi.fn(),
  };
}

describe("assistant draft actions", () => {
  it("returns the same action on a double confirmation", async () => {
    const rpcClient = client({
      confirm_assistant_draft: {
        status: "confirmed",
        action_id: "00000000-0000-0000-0000-000000000701",
        already_confirmed: true,
      },
      track_product_event: 1,
    });
    const result = await createAssistantActions(rpcClient).confirm(
      "10000000-0000-0000-0000-000000000001",
      "00000000-0000-0000-0000-000000000101",
    );
    expect(result.kind).toBe("confirmed");
    expect(result.kind === "confirmed" && result.alreadyConfirmed).toBe(true);
  });

  it("rejects an expired draft without an action id", async () => {
    const result = await createAssistantActions(client({
      confirm_assistant_draft: { status: "expired", action_id: null, already_confirmed: false },
    })).confirm(
      "10000000-0000-0000-0000-000000000001",
      "00000000-0000-0000-0000-000000000101",
    );
    expect(result).toEqual({ kind: "error", message: "Ce brouillon a expiré. Préparez une nouvelle action." });
  });

  it("propagates permission errors from secured RPCs", async () => {
    const rpcClient = {
      rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "forbidden" } }),
      from: vi.fn(),
    };
    await expect(createAssistantActions(rpcClient).cancel(
      "10000000-0000-0000-0000-000000000001",
      "00000000-0000-0000-0000-000000000101",
    )).rejects.toThrow("forbidden");
  });
});

