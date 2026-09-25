"use client";

import * as React from "react";
import { FileUp } from "lucide-react";
import { cn } from "@/lib/utils";

type LocalizedFileInputProps = Omit<React.ComponentProps<"input">, "type"> & {
  chooseLabel?: string;
  emptyLabel?: string;
};

function assignRef<T>(ref: React.ForwardedRef<T>, value: T | null) {
  if (typeof ref === "function") {
    ref(value);
    return;
  }
  if (ref) ref.current = value;
}

const LocalizedFileInput = React.forwardRef<HTMLInputElement, LocalizedFileInputProps>(
  function LocalizedFileInput(
    {
      id,
      className,
      chooseLabel = "Choisir un fichier",
      emptyLabel = "Aucun fichier sélectionné",
      multiple,
      onChange,
      disabled,
      ...props
    },
    forwardedRef,
  ) {
    const generatedId = React.useId();
    const inputId = id ?? generatedId;
    const internalRef = React.useRef<HTMLInputElement | null>(null);
    const [selectionLabel, setSelectionLabel] = React.useState(emptyLabel);

    const setRefs = React.useCallback(
      (node: HTMLInputElement | null) => {
        internalRef.current = node;
        assignRef(forwardedRef, node);
      },
      [forwardedRef],
    );

    return (
      <div className={cn("flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center", className)}>
        <input
          {...props}
          ref={setRefs}
          id={inputId}
          type="file"
          multiple={multiple}
          disabled={disabled}
          className="sr-only"
          onChange={(event) => {
            const files = Array.from(event.currentTarget.files ?? []);
            if (files.length === 0) {
              setSelectionLabel(emptyLabel);
            } else if (files.length === 1) {
              setSelectionLabel(files[0]?.name ?? emptyLabel);
            } else {
              setSelectionLabel(`${files.length} fichiers sélectionnés`);
            }
            onChange?.(event);
          }}
        />
        <label
          htmlFor={inputId}
          aria-disabled={disabled || undefined}
          className={cn(
            "inline-flex min-h-10 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg border border-input bg-background px-3 py-2 text-sm font-medium text-foreground shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground focus-within:ring-3 focus-within:ring-ring/50",
            disabled && "pointer-events-none cursor-not-allowed opacity-50",
          )}
        >
          <FileUp className="size-4" aria-hidden="true" />
          {chooseLabel}
        </label>
        <span
          className="min-w-0 truncate text-sm text-muted-foreground"
          aria-live="polite"
          title={selectionLabel}
        >
          {selectionLabel}
        </span>
      </div>
    );
  },
);

LocalizedFileInput.displayName = "LocalizedFileInput";

export { LocalizedFileInput };
