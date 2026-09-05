import { requireAnyWorkspaceCapability } from "@/lib/saas/server";

export default async function AgendaCapabilityLayout({ children }: { children: React.ReactNode }) {
  await requireAnyWorkspaceCapability(["core_crm", "missions"]);
  return children;
}
