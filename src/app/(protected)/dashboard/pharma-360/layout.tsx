import { requireActiveBrandCapability } from "@/lib/saas/server";

export default async function Pharma360Layout({ children }: { children: React.ReactNode }) {
  await requireActiveBrandCapability("pharma_360");
  return children;
}
