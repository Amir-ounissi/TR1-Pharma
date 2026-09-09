"use client";

import { useState, type ReactNode } from "react";
import { Camera, ListPlus } from "lucide-react";
import { PdfOrderImport } from "@/components/orders/pdf-order-import";
import { Button } from "@/components/ui/button";

export function QuickOrderEntryModes({
  manual,
  isAgent = false,
}: {
  manual: ReactNode;
  isAgent?: boolean;
}) {
  const [mode, setMode] = useState<"quick" | "scan">("quick");

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2 rounded-2xl bg-muted/45 p-1.5">
        <Button
          type="button"
          variant={mode === "quick" ? "default" : "ghost"}
          className="h-11 rounded-xl"
          onClick={() => setMode("quick")}
        >
          <ListPlus className="size-4" />
          Commande rapide
        </Button>
        <Button
          type="button"
          aria-label="Scanner / importer"
          variant={mode === "scan" ? "default" : "ghost"}
          className="h-11 rounded-xl"
          onClick={() => setMode("scan")}
        >
          <Camera className="size-4" />
          Scanner un BC
        </Button>
      </div>

      {mode === "quick" ? manual : <PdfOrderImport isAgent={isAgent} />}
    </div>
  );
}
