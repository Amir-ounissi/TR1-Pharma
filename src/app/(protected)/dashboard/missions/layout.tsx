import { requireWorkspaceCapability } from "@/lib/saas/server";

export default async function MissionsCapabilityLayout({ children }: { children: React.ReactNode }) {
  await requireWorkspaceCapability("missions");
  return children;
}
