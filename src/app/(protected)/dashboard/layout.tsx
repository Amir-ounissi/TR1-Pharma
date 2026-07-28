import { AppShell } from "@/components/app-shell";
import { requireActiveBrand } from "@/lib/auth";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { brand, profile } = await requireActiveBrand();
  return <AppShell brandName={brand.name} userName={profile.full_name}>{children}</AppShell>;
}
