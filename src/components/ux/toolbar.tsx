import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Toolbar({
  children,
  className,
  ...props
}: ComponentProps<"section">) {
  return (
    <section
      className={cn(
        "border-y border-[var(--tr1-line)] bg-white/40 px-0 py-2.5",
        className,
      )}
      {...props}
    >
      {children}
    </section>
  );
}

export function ToolbarRow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("flex flex-wrap items-center gap-2", className)}>{children}</div>;
}

export function ToolbarMeta({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("font-mono text-[0.54rem] font-bold uppercase tracking-[0.12em] text-muted-foreground", className)}>
      {children}
    </div>
  );
}
