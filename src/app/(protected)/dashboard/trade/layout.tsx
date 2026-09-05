import { requireActiveBrandCapability } from "@/lib/saas/server";

export default async function TradeMarketingLayout({ children }: { children: React.ReactNode }) {
  await requireActiveBrandCapability("trade_marketing");
  return children;
}
