import { requireActiveBrandCapability } from "@/lib/saas/server";

export default async function SellOutLayout({ children }: { children: React.ReactNode }) {
  await requireActiveBrandCapability("sell_out");
  return children;
}
