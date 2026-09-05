export type OrderImportHistory = {
  source: string;
  line_items_complete: boolean | null;
  notes: string | null;
};

const HUBSPOT_PATTERN = /hubspot/i;
const INCOMPLETE_PATTERN = /incomplet/i;

export function isIncompleteHubSpotHistory(order: OrderImportHistory) {
  if (order.source !== "import") return false;

  const notes = order.notes ?? "";

  return HUBSPOT_PATTERN.test(notes) && (
    order.line_items_complete === false || INCOMPLETE_PATTERN.test(notes)
  );
}
