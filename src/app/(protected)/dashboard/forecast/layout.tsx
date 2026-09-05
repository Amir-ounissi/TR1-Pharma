import { requireActiveBrandCapability } from "@/lib/saas/server";

export default async function ForecastLayout({ children }: { children: React.ReactNode }) {
  await requireActiveBrandCapability("forecast");
  return children;
}
