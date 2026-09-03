"use client";

import {
  FRANCE_REGIONS,
  sortFranceDepartmentCodes,
} from "@/lib/france-geography";

export function FranceDepartmentSelector({
  selectedCodes,
  onChange,
  disabled = false,
}: {
  selectedCodes: string[];
  onChange: (codes: string[]) => void;
  disabled?: boolean;
}) {
  const selected = new Set(selectedCodes);

  function toggleDepartment(code: string, checked: boolean) {
    const next = new Set(selected);
    if (checked) next.add(code);
    else next.delete(code);
    onChange(sortFranceDepartmentCodes(next));
  }

  function toggleRegion(departmentCodes: readonly string[], checked: boolean) {
    const next = new Set(selected);
    for (const code of departmentCodes) {
      if (checked) next.add(code);
      else next.delete(code);
    }
    onChange(sortFranceDepartmentCodes(next));
  }

  return (
    <div className="max-h-[32rem] space-y-3 overflow-y-auto rounded-xl border bg-muted/20 p-3">
      {FRANCE_REGIONS.map((region) => {
        const regionCodes = region.departments.map((department) => department.code);
        const allSelected = regionCodes.every((code) => selected.has(code));
        const selectedCount = regionCodes.filter((code) => selected.has(code)).length;

        return (
          <div className="rounded-lg border bg-background p-3" key={region.code}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="flex cursor-pointer items-center gap-2 font-medium">
                <input
                  type="checkbox"
                  checked={allSelected}
                  disabled={disabled}
                  onChange={(event) => toggleRegion(regionCodes, event.target.checked)}
                  className="size-4"
                />
                <span>{region.name}</span>
              </label>
              <span className="text-xs text-muted-foreground">
                {selectedCount}/{region.departments.length}
              </span>
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {region.departments.map((department) => (
                <label
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                  key={department.code}
                >
                  <input
                    type="checkbox"
                    name="departmentCodes"
                    value={department.code}
                    checked={selected.has(department.code)}
                    disabled={disabled}
                    onChange={(event) =>
                      toggleDepartment(department.code, event.target.checked)
                    }
                    className="size-4"
                  />
                  <span>
                    <strong>{department.code}</strong> — {department.name}
                  </span>
                </label>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
