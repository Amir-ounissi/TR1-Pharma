"use client";

import { useEffect } from "react";
import { trackMarketingEvent, type MarketingEvent, type MarketingProperties } from "@/lib/marketing/analytics";

export function MarketingPageEvent({ event, properties }: { event: MarketingEvent; properties?: MarketingProperties }) {
  useEffect(() => trackMarketingEvent(event, properties), [event, properties]);
  return null;
}
export function MarketingTrackedLink({ event, properties, ...props }: React.ComponentProps<"a"> & { event: MarketingEvent; properties?: MarketingProperties }) {
  return <a {...props} onClick={(clickEvent) => { trackMarketingEvent(event, properties); props.onClick?.(clickEvent); }} />;
}
