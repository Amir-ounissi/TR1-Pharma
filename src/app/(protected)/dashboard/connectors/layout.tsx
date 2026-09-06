import { requireActiveBrandCapability } from "@/lib/saas/server";

export default async function ConnectorsLayout({ children }: { children: React.ReactNode }) {
  await requireActiveBrandCapability("connectors");
  return children;
}
