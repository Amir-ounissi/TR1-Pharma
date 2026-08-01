export type SearchItemKind = "navigation" | "pharmacy" | "mission" | "task" | "action";

export type SearchItem = {
  id: string;
  kind: SearchItemKind;
  label: string;
  description?: string;
  href: string;
  keywords?: string[];
};

export type SearchGroup = {
  kind: SearchItemKind;
  label: string;
  items: SearchItem[];
};

const groupLabels: Record<SearchItemKind, string> = {
  navigation: "Navigation",
  pharmacy: "Pharmacies",
  mission: "Missions",
  task: "Tâches",
  action: "Actions rapides",
};

export function normalizeSearchValue(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr").trim();
}

export function searchScopedItems(items: SearchItem[], query: string, limit = 12): SearchItem[] {
  const normalizedQuery = normalizeSearchValue(query);
  const tokens = normalizedQuery.split(/\s+/).filter(Boolean);

  return items
    .map((item, index) => {
      const haystack = normalizeSearchValue([item.label, item.description, ...(item.keywords ?? [])].filter(Boolean).join(" "));
      const matches = tokens.every((token) => haystack.includes(token));
      const startsWith = normalizedQuery.length > 0 && normalizeSearchValue(item.label).startsWith(normalizedQuery);
      return { item, index, matches: normalizedQuery.length === 0 || matches, score: startsWith ? 0 : 1 };
    })
    .filter((entry) => entry.matches)
    .sort((left, right) => left.score - right.score || left.index - right.index)
    .slice(0, limit)
    .map((entry) => entry.item);
}

export function groupSearchItems(items: SearchItem[]): SearchGroup[] {
  const order: SearchItemKind[] = ["action", "navigation", "pharmacy", "mission", "task"];
  return order.flatMap((kind) => {
    const matchingItems = items.filter((item) => item.kind === kind);
    return matchingItems.length ? [{ kind, label: groupLabels[kind], items: matchingItems }] : [];
  });
}

export function moveSearchSelection(current: number, direction: 1 | -1, total: number) {
  if (total <= 0) return -1;
  if (current < 0) return direction === 1 ? 0 : total - 1;
  return (current + direction + total) % total;
}
