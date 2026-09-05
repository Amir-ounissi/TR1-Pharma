import { requireAnyActiveBrandCapability } from "@/lib/saas/server";

export default async function AgendaCapabilityLayout({ children }: { children: React.ReactNode }) {
  await requireAnyActiveBrandCapability(["core_crm", "missions"]);
  return children;
}
