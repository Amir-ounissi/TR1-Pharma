import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";
export default function OwnerLogin() {
  return <main className="mx-auto max-w-md px-5 py-16">
    <Link href="/" className="text-xs font-bold text-[#ad4b08]">← Retour au site</Link>
    <h1 className="mt-6 text-3xl font-bold">Cockpit TR1</h1>
    <p className="mt-2 text-sm text-[#69717d]">Espace personnel commercial multimarque.</p>
    <LoginForm />
  </main>;
}
