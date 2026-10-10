"use client";

import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";

type PersistedLine = {
  key: string;
  productId: string;
  quantity: number;
  freeQuantity: number;
  commercialFreeQuantity?: number;
  manualFreeQuantity?: number;
  freeClassification?: string;
  unitPriceHt: string;
  discountRate: string;
};

type SavedDraft = {
  version: 1;
  savedAt: number;
  orderType: string;
  lines: PersistedLine[];
};

type OrderLine = { productId: string; quantity: number };

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const ORDER_TYPES = new Set([
  "initial", "reorder", "complementary", "replacement",
  "sample", "return", "credit_note", "other",
]);

function nonnegativeInteger(value: unknown): number | null {
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 && number <= 100_000
    ? number
    : null;
}

function amount(value: unknown): string {
  const text = String(value ?? "");
  return /^\d{0,9}(?:\.\d{0,4})?$/.test(text) ? text : "";
}

function discount(value: unknown): string {
  const text = String(value ?? "");
  if (text === "") return "";
  const number = Number(text);
  return Number.isFinite(number) && number >= 0 && number <= 100 ? text : "";
}

function normalizeLine(value: unknown, products: ReadonlySet<string>, mode: "mobile" | "desktop"): PersistedLine | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (typeof row.productId !== "string" || !products.has(row.productId)) return null;
  const quantity = nonnegativeInteger(row.quantity);
  const freeQuantity = nonnegativeInteger(row.freeQuantity);
  if (quantity === null || freeQuantity === null) return null;
  const line: PersistedLine = {
    key: typeof row.key === "string" && row.key.length <= 100 ? row.key : crypto.randomUUID(),
    productId: row.productId,
    quantity,
    freeQuantity,
    unitPriceHt: amount(row.unitPriceHt),
    discountRate: discount(row.discountRate),
  };
  if (mode === "desktop") {
    line.commercialFreeQuantity = nonnegativeInteger(row.commercialFreeQuantity) ?? freeQuantity;
    line.manualFreeQuantity = nonnegativeInteger(row.manualFreeQuantity) ?? 0;
    line.freeClassification = typeof row.freeClassification === "string"
      ? row.freeClassification.slice(0, 80)
      : "";
  }
  return line;
}

/**
 * Keeps an unfinished order on this browser tab, never on the server.
 * Scope includes the signed-in user, active brand, pharmacy and form mode.
 * No draft is re-used for a different tenant, account or device.
 */
export function useLocalOrderDraft<T extends OrderLine>({
  scope,
  mode,
  productIds,
  lines,
  setLines,
  orderType,
  setOrderType,
  completed,
}: {
  scope: string;
  mode: "mobile" | "desktop";
  productIds: string[];
  lines: T[];
  setLines: Dispatch<SetStateAction<T[]>>;
  orderType: string;
  setOrderType: Dispatch<SetStateAction<string>>;
  completed: boolean;
}) {
  const key = `tr1:quick-order-draft:v1:${scope}:${mode}`;
  const idsKey = useMemo(() => productIds.join("|"), [productIds]);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    // Defer restored state until after hydration; avoid synchronous cascading renders.
    const timer = window.setTimeout(() => {
    let recovered = false;
    try {
      const raw = window.sessionStorage.getItem(key);
      if (raw) {
        const value: unknown = JSON.parse(raw);
        if (value && typeof value === "object") {
          const draft = value as Partial<SavedDraft>;
          if (draft.version === 1 && typeof draft.savedAt === "number" &&
            Date.now() - draft.savedAt >= 0 && Date.now() - draft.savedAt < ONE_DAY_MS &&
            Array.isArray(draft.lines)) {
            const validProducts = new Set(idsKey.split("|"));
            const normalized = draft.lines.slice(0, 100)
              .map((line) => normalizeLine(line, validProducts, mode))
              .filter((line): line is PersistedLine => line !== null);
            if (normalized.length) {
              setLines(normalized as unknown as T[]);
              if (typeof draft.orderType === "string" && ORDER_TYPES.has(draft.orderType)) {
                setOrderType(draft.orderType);
              }
              recovered = true;
            }
          }
        }
      }
    } catch {
      // Private browsing and disabled storage must not block order entry.
    }
    setRestored(recovered);
    setActiveKey(key);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [key, idsKey, mode, setLines, setOrderType]);

  useEffect(() => {
    if (activeKey !== key) return;
    try {
      if (completed) {
        window.sessionStorage.removeItem(key);
      } else {
        const draft: SavedDraft = {
          version: 1,
          savedAt: Date.now(),
          orderType,
          lines: lines.slice(0, 100) as unknown as PersistedLine[],
        };
        window.sessionStorage.setItem(key, JSON.stringify(draft));
      }
    } catch {
      // Storage is optional; the normal server submission remains available.
    }
  }, [activeKey, key, lines, orderType, completed]);

  return { restored: restored && activeKey === key };
}
