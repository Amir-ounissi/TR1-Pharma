import { requireActiveBrandCapability } from "@/lib/saas/server";

export default async function OrdersCapabilityLayout({ children }: { children: React.ReactNode }) {
  await requireActiveBrandCapability("orders");
  return children;
}
