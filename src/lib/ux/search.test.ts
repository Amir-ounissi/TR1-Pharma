import { describe, expect, it } from "vitest";
import { groupSearchItems, mentionedSearchBrands, moveSearchSelection, searchCandidateFragments, searchIntent, searchScopedItems, type SearchItem } from "./search";

const scopedItems: SearchItem[] = [
  { id: "pharmacy-1", kind: "pharmacy", label: "Pharmacie des Lilas", description: "Paris", href: "/dashboard/pharmacies/1" },
  { id: "mission-1", kind: "mission", label: "Animation Dermavita", href: "/dashboard/missions/1" },
  { id: "task-1", kind: "task", label: "Relancer les Lilas", href: "/dashboard/tasks" },
];

describe("permission-scoped search", () => {
  it("searches only the items supplied by the RLS-scoped server query", () => {
    expect(searchScopedItems(scopedItems, "lilas").map((item) => item.id)).toEqual(["pharmacy-1", "task-1"]);
    expect(searchScopedItems(scopedItems, "autre marque")).toEqual([]);
  });

  it("normalizes accents, groups results and applies a limit", () => {
    expect(searchScopedItems(scopedItems, "pharmacie des", 1)).toHaveLength(1);
    expect(groupSearchItems(searchScopedItems(scopedItems, ""))).toHaveLength(3);
  });

  it("wraps keyboard selection", () => {
    expect(moveSearchSelection(-1, 1, 3)).toBe(0);
    expect(moveSearchSelection(2, 1, 3)).toBe(0);
    expect(moveSearchSelection(0, -1, 3)).toBe(2);
  });
});

describe("recherche intelligente multimarque", () => {
  const brands = [
    { id: "naali", name: "Naali" },
    { id: "vk", name: "VK SWISS" },
  ];

  it("détecte une marque mentionnée sans confondre les mots contenus dans d'autres noms", () => {
    expect(mentionedSearchBrands("commandes VK Swiss", brands).map((brand) => brand.id)).toEqual(["vk"]);
    expect(mentionedSearchBrands("pharmacies", brands)).toEqual([]);
    expect(mentionedSearchBrands("Naali et VK Swiss", brands)).toHaveLength(2);
  });

  it("reconnaît les intentions commerciales en français", () => {
    expect(searchIntent("pharmacies à relancer").followUps).toBe(true);
    expect(searchIntent("Créer commande Praden").createOrder).toBe(true);
    expect(searchIntent("commandes VK SWISS").orders).toBe(true);
    expect(searchIntent("pharmacies prioritaires").priority).toBe(true);
  });

  it("retrouve des candidats avec accents et fautes sans requête globale non bornée", () => {
    expect(searchCandidateFragments("plna campgne", brands)).toContain("cam");
    expect(searchCandidateFragments("République", brands)).toContain("ubl");
    expect(searchCandidateFragments("commandes VK SWISS", brands)).toEqual([]);
  });

  it("classe et accepte les fautes de frappe sur les seuls résultats déjà autorisés", () => {
    const items: SearchItem[] = [
      { id: "1", kind: "pharmacy", label: "Pharmacie Plan de Campagne", description: "Naali", href: "/dashboard/pharmacies/1" },
      { id: "2", kind: "pharmacy", label: "Pharmacie Bellecour", description: "VK SWISS", href: "/dashboard/pharmacies/2" },
      { id: "3", kind: "product", label: "Safran Kids", description: "Naali", href: "/dashboard/products?product=3" },
    ];
    expect(searchScopedItems(items, "plna campgne").map((item) => item.id)).toEqual(["1"]);
    expect(searchScopedItems(items, "Safrn Kids").map((item) => item.id)).toEqual(["3"]);
    expect(searchScopedItems(items, "pharmacie hors portefeuille")).toEqual([]);
    expect(groupSearchItems(items).map((group) => group.kind)).toEqual(["pharmacy", "product"]);
  });
});
