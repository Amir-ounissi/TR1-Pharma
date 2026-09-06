import { requireActiveBrandCapability } from "@/lib/saas/server";

export default async function ExecutiveCockpitLayout({ children }: { children: React.ReactNode }) {
  await requireActiveBrandCapability("executive_cockpit");
  return children;
}
