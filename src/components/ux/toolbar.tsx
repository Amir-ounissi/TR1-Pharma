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
        "rounded-[0.75rem] border border-[var(--tr1-line)] bg-white px-3 py-2.5",
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
    <div className={cn("text-xs font-medium text-muted-foreground", className)}>
      {children}
    </div>
  );
}
