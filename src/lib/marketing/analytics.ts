export const marketingEvents = [
  "landing_view",
  "primary_cta_click",
  "product_tab_view",
  "lead_form_start",
  "lead_form_validation_error",
  "lead_form_submit",
  "thank_you_view",
  "booking_click",
] as const;

export type MarketingEvent = (typeof marketingEvents)[number];
export type MarketingProperties = Record<string, string | number | boolean>;

export function sanitizeMarketingProperties(properties: MarketingProperties = {}) {
  const forbidden = /name|email|note|message|company|phone/i;
  return Object.fromEntries(Object.entries(properties).filter(([key]) => !forbidden.test(key)));
}
export function trackMarketingEvent(event: MarketingEvent, properties: MarketingProperties = {}) {
  if (typeof window === "undefined") return;
  const detail = { event, properties: sanitizeMarketingProperties(properties) };
  window.dispatchEvent(new CustomEvent("tr1:marketing", { detail }));
  if (process.env.NEXT_PUBLIC_ANALYTICS_PROVIDER === "dataLayer") {
    const target = window as typeof window & { dataLayer?: Array<Record<string, unknown>> };
    target.dataLayer ??= [];
    target.dataLayer.push({ event, ...detail.properties });
  }
}
