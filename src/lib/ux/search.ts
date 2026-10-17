export type SearchItemKind = "navigation" | "pharmacy" | "mission" | "task" | "action" | "product" | "order";

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
  product: "Produits",
  order: "Commandes",
};

const ignoredWords = new Set([
  "a", "au", "aux", "de", "des", "du", "en", "et", "je", "la", "le", "les",
  "ma", "mes", "mon", "nos", "notre", "par", "pour", "que", "sur", "un", "une",
  "voir", "montre", "trouve", "retrouve", "cherche", "chercher", "affiche",
]);

const categoryWords = new Set([
  "pharmacie", "pharmacies", "officine", "officines", "produit", "produits",
  "commande", "commandes", "mission", "missions", "tache", "taches",
  "creer", "nouvelle", "nouveau", "faire", "ouvrir", "liste", "toutes", "tous",
  "relance", "relancer", "relances", "inactives", "inactive", "inactif",
  "prioritaire", "prioritaires", "reassort", "reassorts",
]);

export function normalizeSearchValue(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr").trim();
}

export function tokenizeSearch(value: string): string[] {
  return normalizeSearchValue(value).replace(/[^\p{L}\p{N}]+/gu, " ").split(/\s+/).filter(Boolean);
}

export function mentionedSearchBrands(query: string, brands: readonly { id: string; name: string }[]) {
  const paddedQuery = ` ${tokenizeSearch(query).join(" ")} `;
  return brands.filter((brand) => {
    const phrase = tokenizeSearch(brand.name).join(" ");
    return Boolean(phrase) && paddedQuery.includes(` ${phrase} `);
  });
}

/** Obtain a selective prefix even for a mistyped phrase, without a full-table scan. */
export function searchCandidateFragment(query: string, brands: readonly { id: string; name: string }[]): string {
  const excluded = new Set(brands.flatMap((brand) => tokenizeSearch(brand.name)));
  const tokens = tokenizeSearch(query).filter((token) =>
    !ignoredWords.has(token) && !categoryWords.has(token) && !excluded.has(token),
  );
  const longest = tokens.sort((a, b) => b.length - a.length)[0] ?? "";
  if (longest.length <= 3) return longest;
  // A middle trigram survives many leading-character errors and accent variations.
  return longest.slice(Math.floor((longest.length - 3) / 2), Math.floor((longest.length - 3) / 2) + 3);
}

export function searchIntent(query: string) {
  const words = tokenizeSearch(query);
  return {
    orders: words.some((word) => /^(commande|commandes|reassort)/.test(word)),
    createOrder: words.some((word) => /^(creer|nouvelle|nouveau|faire|saisir)/.test(word)) &&
      words.some((word) => /^(commande|reassort)/.test(word)),
    pharmacies: words.some((word) => /^(pharmaci|officine)/.test(word)),
    products: words.some((word) => /^(produit|reference|stock)/.test(word)),
    followUps: words.some((word) => /^(relanc|inactiv|dormant)/.test(word)),
    priority: words.some((word) => /^(priorit|strategiq)/.test(word)),
  };
}

function distanceWithin(left: string, right: string, max: number) {
  if (Math.abs(left.length - right.length) > max) return false;
  if (left === right) return true;
  let previous = Array.from({ length: right.length + 1 }, (_, i) => i);
  for (let i = 1; i <= left.length; i += 1) {
    const current = [i];
    let minimum = current[0];
    for (let j = 1; j <= right.length; j += 1) {
      const substitution = previous[j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1);
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, substitution);
      minimum = Math.min(minimum, current[j]);
    }
    if (minimum > max) return false;
    previous = current;
  }
  return previous[right.length] <= max;
}

function tokenMatch(token: string, words: string[], haystack: string) {
  if (haystack.includes(token)) return 0;
  if (token.length < 4) return -1;
  const tolerance = token.length >= 7 ? 2 : 1;
  return words.some((word) => distanceWithin(token, word, tolerance)) ? 2 : -1;
}

/** Rank only entries supplied by permission-scoped reads; fuzzy matching never broadens access. */
export function searchScopedItems(items: SearchItem[], query: string, limit = 16): SearchItem[] {
  const normalizedQuery = normalizeSearchValue(query);
  const tokens = tokenizeSearch(query).filter((word) => !ignoredWords.has(word));
  return items
    .map((item, index) => {
      const label = normalizeSearchValue(item.label);
      const haystack = normalizeSearchValue([item.label, item.description, ...(item.keywords ?? [])].filter(Boolean).join(" "));
      const words = tokenizeSearch(haystack);
      const matches = tokens.map((token) => tokenMatch(token, words, haystack));
      const valid = tokens.length === 0 || matches.every((score) => score >= 0);
      const score = (label === normalizedQuery ? -6 : label.startsWith(normalizedQuery) ? -4 : 0)
        + matches.reduce((sum, current) => sum + current, 0);
      return { item, index, valid, score };
    })
    .filter((entry) => entry.valid)
    .sort((left, right) => left.score - right.score || left.index - right.index)
    .slice(0, limit)
    .map((entry) => entry.item);
}

export function groupSearchItems(items: SearchItem[]): SearchGroup[] {
  const order: SearchItemKind[] = ["action", "pharmacy", "product", "order", "navigation", "mission", "task"];
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
