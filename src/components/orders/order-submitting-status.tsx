"use client";

import { useFormStatus } from "react-dom";
import { LoaderCircle } from "lucide-react";

/** Visible immediately on submit, while the server validates and saves the order. */
export function OrderSubmittingStatus() {
  const { pending } = useFormStatus();
  if (!pending) return null;
  return (
    <p role="status" aria-live="polite" className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2 text-sm text-foreground">
      <LoaderCircle aria-hidden="true" className="size-4 shrink-0 animate-spin text-[var(--tr1-orange)]" />
      Enregistrement de la commande…
    </p>
  );
}
