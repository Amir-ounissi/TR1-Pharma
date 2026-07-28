"use client";

import Link from "next/link";
import { startTransition, type ReactNode } from "react";
import { trackProductEventAction } from "@/app/(protected)/dashboard/agent/actions";
import { cn } from "@/lib/utils";

type EventName = "pharmacy_opened" | "navigation_waze_clicked" | "navigation_maps_clicked" | "interaction_started";

export function TrackedLink({
  href,
  eventName,
  pharmacyId,
  children,
  className,
  external = false,
}: {
  href: string;
  eventName: EventName;
  pharmacyId?: string;
  children: ReactNode;
  className?: string;
  external?: boolean;
}) {
  const shared = {
    className: cn("inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold transition-colors", className),
    onClick: () => startTransition(() => { void trackProductEventAction(eventName, pharmacyId); }),
  };
  if (external) {
    return <a href={href} target="_blank" rel="noreferrer" {...shared}>{children}</a>;
  }
  return <Link href={href} {...shared}>{children}</Link>;
}
