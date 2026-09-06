import { requireActiveBrandCapability } from "@/lib/saas/server";

export default async function ProvidersLayout({ children }: { children: React.ReactNode }) {
  await requireActiveBrandCapability("multi_provider");
  return children;
}
