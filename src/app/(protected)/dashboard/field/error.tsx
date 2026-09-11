"use client";

import Link from "next/link";
import { AlertTriangle, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type FieldErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function FieldError({ error, reset }: FieldErrorProps) {
  const isGatewayTimeout = /gateway timeout/i.test(error.message);

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-24">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--tr1-orange)]">Terrain</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight text-[var(--tr1-navy)]">Aujourd’hui</h1>
      </header>

      <Card className="border-amber-300 bg-amber-50/70">
        <CardContent className="space-y-4 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-700" />
            <div>
              <p className="font-bold text-[var(--tr1-navy)]">
                {isGatewayTimeout ? "L’agenda met trop de temps à répondre." : "La vue terrain n’a pas pu se charger."}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                TR1 reste accessible. Réessayez la vue terrain ou ouvrez directement votre portefeuille pharmacies.
              </p>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <Button type="button" onClick={reset}>
              <RefreshCw className="size-4" /> Réessayer
            </Button>
            <Button asChild variant="outline">
              <Link href="/dashboard/pharmacies">
                <Search className="size-4" /> Pharmacies
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
