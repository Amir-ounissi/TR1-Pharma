import Link from "next/link";
import { requireOwner } from "@/lib/auth";
import { signOutAction } from "@/app/auth-actions";
import { OwnerNavigation } from "@/components/owner/navigation";
import { Tr1BrandLogo } from "@/components/brand/tr1-brand-logo";

export default async function CockpitLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireOwner();
  return <div className="min-h-screen bg-[#f6f7f6] text-[#0e1d31] md:grid md:grid-cols-[230px_1fr]">
    <aside className="bg-[#142941] p-5 text-white">
      <Link href="/" className="mb-8 block rounded-lg bg-white p-2" aria-label="Site public TR1">
        <Tr1BrandLogo className="h-12 w-24" />
      </Link>
      <p className="mb-3 px-4 text-xs font-bold uppercase tracking-widest text-white/45">Mon espace TR1</p>
      <OwnerNavigation />
      <form action={signOutAction} className="mt-8 border-t border-white/15 pt-6">
        <button className="px-4 text-sm text-white/70 hover:text-white">Se déconnecter</button>
      </form>
    </aside>
    <div>
      <header className="flex min-h-16 items-center justify-between border-b bg-white px-6">
        <span className="text-sm font-bold">TR1 PHARMA · Cockpit multimarque</span>
        <span className="text-xs text-[#69717d]">{viewer.name || viewer.user.email}</span>
      </header>
      <main className="mx-auto max-w-6xl p-5 sm:p-8">{children}</main>
    </div>
  </div>;
}
