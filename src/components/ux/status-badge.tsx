import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type StatusTone = "neutral" | "information" | "active" | "success" | "attention" | "overdue" | "critical";

const toneClasses: Record<StatusTone, string> = {
  neutral: "border-border bg-muted/60 text-muted-foreground",
  information: "border-blue-200 bg-blue-50 text-blue-800",
  active: "border-orange-200 bg-orange-50 text-orange-800",
  success: "border-green-200 bg-green-50 text-green-800",
  attention: "border-amber-200 bg-amber-50 text-amber-800",
  overdue: "border-red-200 bg-red-50 text-red-800",
  critical: "border-red-300 bg-red-100 text-red-900",
};

export function StatusBadge({ tone = "neutral", className, children }: { tone?: StatusTone; className?: string; children: React.ReactNode }) {
  return <Badge className={cn("border font-mono text-[0.68rem] font-semibold", toneClasses[tone], className)} variant="outline">{children}</Badge>;
}
