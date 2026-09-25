"use client";

import {
  forwardRef,
  useId,
  useState,
  type ComponentPropsWithoutRef,
} from "react";
import { cn } from "@/lib/utils";

type LocalizedFileInputProps = Omit<ComponentPropsWithoutRef<"input">, "type"> & {
  buttonLabel?: string;
  emptyLabel?: string;
};

export const LocalizedFileInput = forwardRef<HTMLInputElement, LocalizedFileInputProps>(
  function LocalizedFileInput(
    {
      id: providedId,
      className,
      buttonLabel = "Choisir un fichier",
      emptyLabel = "Aucun fichier sélectionné",
      onChange,
      multiple,
      ...props
    },
    ref,
  ) {
    const generatedId = useId();
    const id = providedId ?? generatedId;
    const [selectionLabel, setSelectionLabel] = useState(emptyLabel);

    return (
      <div
        className={cn(
          "border-input bg-background flex min-h-10 w-full items-stretch overflow-hidden rounded-md border text-sm",
          className,
        )}
      >
        <input
          {...props}
          ref={ref}
          id={id}
          type="file"
          multiple={multiple}
          className="sr-only"
          onChange={(event) => {
            const files = Array.from(event.currentTarget.files ?? []);
            setSelectionLabel(
              files.length === 0
                ? emptyLabel
                : files.length === 1
                  ? files[0]?.name ?? emptyLabel
                  : `${files.length} fichiers sélectionnés`,
            );
            onChange?.(event);
          }}
        />
        <label
          htmlFor={id}
          className="bg-muted hover:bg-muted/80 focus-within:ring-ring flex shrink-0 cursor-pointer items-center border-r px-3 font-medium transition-colors"
        >
          {buttonLabel}
        </label>
        <span
          className="min-w-0 flex-1 truncate px-3 py-2 text-muted-foreground"
          aria-live="polite"
        >
          {selectionLabel}
        </span>
      </div>
    );
  },
);
