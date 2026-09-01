import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export function InlineError({
  title,
  description,
  action,
  secondaryAction,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  secondaryAction?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-[0.8rem] border border-[#e8b2a2] bg-[#fff4ef] px-4 py-4 text-[#8f2e19]",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{title}</p>
          {description ? <p className="mt-1 text-sm text-[#9b4a38]">{description}</p> : null}
          {action || secondaryAction ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {action}
              {secondaryAction}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
