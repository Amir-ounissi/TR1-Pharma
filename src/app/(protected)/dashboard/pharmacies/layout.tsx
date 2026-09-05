import { requireActiveBrandCapability } from "@/lib/saas/server";

export default async function PharmaciesCapabilityLayout({ children }: { children: React.ReactNode }) {
  await requireActiveBrandCapability("core_crm");
  return children;
}
