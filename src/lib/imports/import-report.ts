import type { ImportExecutionPlan } from "./import-executor";
import type { ImportPreview } from "./import-types";

export type ImportReport = {
  generatedAt: string;
  type: ImportPreview["type"];
  totalRows: number;
  created: number;
  updated: number;
  ignored: number;
  warnings: number;
  errors: number;
  status: "ready" | "blocked";
};

export function createImportReport(preview: ImportPreview, plan: ImportExecutionPlan, generatedAt = new Date().toISOString()): ImportReport {
  return {
    generatedAt,
    type: preview.type,
    totalRows: preview.summary.total,
    created: plan.creates,
    updated: plan.updates,
    ignored: plan.ignored,
    warnings: preview.summary.warnings,
    errors: preview.summary.errors,
    status: plan.executable ? "ready" : "blocked",
  };
}

export function reportToCsv(report: ImportReport) {
  return [
    "type;total;creations;mises_a_jour;ignorees;avertissements;erreurs;statut",
    [report.type, report.totalRows, report.created, report.updated, report.ignored, report.warnings, report.errors, report.status].join(";"),
  ].join("\n");
}
