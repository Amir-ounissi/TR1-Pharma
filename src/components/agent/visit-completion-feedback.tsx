"use client";

import { useEffect } from "react";
import { Check } from "lucide-react";

export function VisitCompletionFeedback({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, 8_000);
    return () => window.clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div role="status" aria-live="polite" className="visit-completion-feedback flex items-start gap-3 rounded-[0.5rem] border border-[#4f7a58]/30 bg-[#eef5ef] px-4 py-4 text-[#31523a] shadow-[0_10px_30px_rgb(79_122_88/0.12)]">
      <span className="visit-completion-check grid size-9 shrink-0 place-items-center rounded-full bg-[var(--tr1-success)] text-white" aria-hidden="true"><Check className="size-5" strokeWidth={3} /></span>
      <div><p className="font-semibold">Visite terminée</p><p className="mt-0.5 text-sm">{message}</p></div>
    </div>
  );
}
