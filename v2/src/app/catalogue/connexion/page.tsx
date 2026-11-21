import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";
export default function CatalogueLogin() {
  return <main className="mx-auto max-w-md px-5 py-16">
    <Link href="/" className="text-xs font-bold text-[#ad4b08]">← Retour au site</Link>
    <h1 className="mt-6 text-3xl font-bold">Catalogue professionnel</h1>
    <p className="mt-2 text-sm text-[#69717d]">Accès réservé aux pharmacies autorisées.</p>
    <LoginForm />
    <p className="mt-6 text-sm">Pas encore de compte ? <Link href="/catalogue/demander-acces" className="font-semibold underline">Demander l'accès</Link></p>
  </main>;
}
