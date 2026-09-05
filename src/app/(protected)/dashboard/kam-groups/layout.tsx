import { requireActiveBrandCapability } from "@/lib/saas/server";

export default async function KamGroupsLayout({ children }: { children: React.ReactNode }) {
  await requireActiveBrandCapability("kam_groups");
  return children;
}
