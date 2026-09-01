"use client";

import { cn } from "@/lib/utils";

export function PharmacyMarker({
  x,
  y,
  tone,
  active,
  label,
  strategic = false,
  animated = false,
  onSelect,
}: {
  x: number;
  y: number;
  tone: "neutral" | "accent" | "warning" | "success" | "muted";
  active: boolean;
  label: string;
  strategic?: boolean;
  animated?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      aria-label={label}
      className="group absolute -translate-x-1/2 -translate-y-1/2 focus-visible:outline-none"
      onClick={onSelect}
      style={{ left: `${x}px`, top: `${y}px` }}
      type="button"
    >
      {animated ? (
        <span className="absolute left-1/2 top-1/2 block size-7 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[var(--tr1-orange)]/50" />
      ) : null}
      <span
        className={cn(
          "block size-3 rounded-full border-2 border-white shadow-[0_4px_18px_rgba(11,30,50,0.16)] transition-transform group-hover:scale-110",
          tone === "neutral" && "bg-[var(--tr1-navy)]",
          tone === "accent" && "bg-[var(--tr1-orange)]",
          tone === "warning" && "bg-[#d86838]",
          tone === "success" && "bg-[#365f8b]",
          tone === "muted" && "bg-[#b6aa96]",
          active && "scale-125 ring-4 ring-[var(--tr1-orange)]/18",
        )}
      />
      {strategic ? (
        <span className="absolute -right-1.5 -top-2 font-mono text-[0.74rem] text-[var(--tr1-orange)]">★</span>
      ) : null}
    </button>
  );
}
