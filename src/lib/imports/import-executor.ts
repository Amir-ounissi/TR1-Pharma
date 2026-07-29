import type { ImportMode, ImportPreview } from "./import-types";

export type ImportExecutionPlan = {
  mode: ImportMode;
  creates: number;
  updates: number;
  ignored: number;
  blocked: number;
  executable: boolean;
};

export function buildExecutionPlan(preview: ImportPreview, mode: ImportMode): ImportExecutionPlan {
  const invalid = preview.rows.filter((row) => row.status === "invalid").length;
  const duplicateWarnings = preview.rows.filter((row) => row.issues.some((issue) => issue.message.includes("Doublon"))).length;
  const valid = preview.rows.length - invalid;
  const updates = ["update_only", "upsert"].includes(mode) ? duplicateWarnings : 0;
  const ignored = mode === "create_only" ? duplicateWarnings : 0;
  return {
    mode,
    creates: mode === "update_only" ? 0 : Math.max(0, valid - duplicateWarnings),
    updates,
    ignored,
    blocked: invalid,
    executable: invalid === 0 && valid > 0,
  };
}

export function assertExecutable(plan: ImportExecutionPlan) {
  if (!plan.executable) throw new Error("L’import contient des lignes invalides. Corrigez-les avant l’exécution transactionnelle.");
}
