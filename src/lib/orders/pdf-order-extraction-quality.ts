import { calculateOrderTotal, consolidatePdfOrderLines } from "@/lib/orders/pdf-order-matching";
import type { PdfOrderExtraction } from "@/lib/orders/pdf-order-schema";

const MONEY_TOLERANCE = 0.02;
const VAT_TOLERANCE = 0.05;

export type PdfOrderExtractionQuality = {
  reliable: boolean;
  issues: string[];
  calculatedHt: number | null;
  lineCount: number;
};

export function canonicalizePdfOrderExtraction(extraction: PdfOrderExtraction): PdfOrderExtraction {
  return {
    ...extraction,
    lines: consolidatePdfOrderLines(extraction.lines),
  };
}

export function assessPdfOrderExtraction(extraction: PdfOrderExtraction): PdfOrderExtractionQuality {
  const canonical = canonicalizePdfOrderExtraction(extraction);
  const issues: string[] = [];
  const paidLines = canonical.lines.filter((line) => (line.quantity ?? 0) > 0);
  const unresolvedFreeLines = canonical.lines.filter(
    (line) => (line.quantity ?? 0) <= 0 && (line.freeQuantity ?? 0) > 0,
  );

  if (paidLines.length === 0) {
    issues.push("Aucune ligne payante exploitable n'a été extraite.");
  }

  if (unresolvedFreeLines.length > 0) {
    issues.push(`${unresolvedFreeLines.length} ligne(s) d'UG ne sont rattachées à aucun produit payant.`);
  }

  const missingPrices = paidLines.filter((line) => line.unitPriceHt == null);
  if (missingPrices.length > 0) {
    issues.push(`${missingPrices.length} ligne(s) payante(s) n'ont pas de prix unitaire HT lisible.`);
  }

  const calculatedHt = paidLines.length > 0 && missingPrices.length === 0
    ? calculateOrderTotal(paidLines)
    : null;

  if (
    extraction.totalHt != null
    && calculatedHt != null
    && Math.abs(extraction.totalHt - calculatedHt) > MONEY_TOLERANCE
  ) {
    issues.push(
      `Le total HT recalculé (${calculatedHt.toFixed(2)} €) diffère du total HT du document (${extraction.totalHt.toFixed(2)} €).`,
    );
  }

  if (
    extraction.totalHt != null
    && extraction.totalVat != null
    && extraction.totalTtc != null
    && Math.abs((extraction.totalHt + extraction.totalVat) - extraction.totalTtc) > VAT_TOLERANCE
  ) {
    issues.push("Les totaux HT, TVA et TTC extraits ne sont pas cohérents entre eux.");
  }

  return {
    reliable: issues.length === 0,
    issues,
    calculatedHt,
    lineCount: canonical.lines.length,
  };
}

export function buildPdfOrderRepairPrompt(
  extraction: PdfOrderExtraction,
  issues: string[],
) {
  const printedTotals = [
    extraction.totalHt != null ? `- total HT candidat lu sur le document : ${extraction.totalHt.toFixed(2)} €` : null,
    extraction.totalVat != null ? `- TVA totale candidate : ${extraction.totalVat.toFixed(2)} €` : null,
    extraction.totalTtc != null ? `- total TTC candidat : ${extraction.totalTtc.toFixed(2)} €` : null,
  ].filter((value): value is string => Boolean(value));

  return [
    "La première lecture n'est pas suffisamment fiable. Relis le PDF depuis zéro, visuellement, sans réutiliser la liste de lignes de la première lecture.",
    "La première extraction peut avoir inventé des quantités positives sur des références simplement présentes au catalogue : ne lui fais pas confiance.",
    "Repars des lignes physiques du tableau et conserve uniquement celles où une quantité commandée positive ou des UG positives sont réellement imprimées dans la bonne colonne.",
    "Pour chaque ligne payante, vérifie séparément Désignation, Qté Cmde, Qté UG, Prix Achat/brut, Remise et Prix Net. Ne décale jamais une cellule depuis la ligne voisine.",
    "Une référence avec prix mais sans Qté Cmde ni UG n'est pas commandée et doit être ignorée.",
    "Ne modifie jamais un chiffre uniquement pour forcer le total : le total imprimé sert seulement de contrôle final.",
    "Contrôles déterministes qui ont échoué :",
    ...issues.map((issue) => `- ${issue}`),
    ...(printedTotals.length ? ["Repères financiers à revérifier directement sur le document :", ...printedTotals] : []),
    "Avant de répondre, recompte le nombre de lignes réellement commandées puis recalcule le HT à partir des quantités payantes, prix HT avant remise et remises. Les UG ne contribuent jamais au CA HT.",
  ].join("\n");
}
