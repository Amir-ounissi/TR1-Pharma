import { NextResponse } from "next/server";
import { getBrandContexts, requireActiveBrand } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const allowedRoles = new Set(["agent", "brand_user", "brand_admin", "tr1_manager", "super_admin"]);
const allowedDocumentTypes = new Set(["kbis", "rib", "sepa"]);

function safeFileName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 180) || "document";
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; type: string }> },
) {
  try {
    const { id, type } = await params;
    const documentType = type.toLowerCase();

    if (!allowedDocumentTypes.has(documentType)) {
      return NextResponse.json({ error: "Type de document invalide." }, { status: 400 });
    }

    const { supabase, brand } = await requireActiveBrand();
    const contexts = await getBrandContexts();
    const role = contexts.find((context) => context.id === brand.id)?.role ?? "brand_user";
    if (!allowedRoles.has(role)) {
      return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
    }

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id,pharmacy_id")
      .eq("id", id)
      .eq("brand_id", brand.id)
      .maybeSingle();

    if (orderError || !order) {
      return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });
    }

    const admin = createAdminClient();
    const { data: document, error: documentError } = await admin
      .from("pharmacy_documents")
      .select("file_name,content_type,object_path")
      .eq("pharmacy_id", order.pharmacy_id)
      .eq("document_type", documentType)
      .maybeSingle();

    if (documentError || !document) {
      return NextResponse.json({ error: `${documentType.toUpperCase()} introuvable.` }, { status: 404 });
    }

    const { data, error: storageError } = await admin.storage
      .from("pharmacy-documents")
      .download(document.object_path);

    if (storageError || !data) {
      return NextResponse.json({ error: "Le fichier enregistré est introuvable dans le stockage." }, { status: 404 });
    }

    return new Response(await data.arrayBuffer(), {
      status: 200,
      headers: {
        "Content-Type": document.content_type || "application/octet-stream",
        "Content-Disposition": `inline; filename="${safeFileName(document.file_name)}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Impossible d’ouvrir le document." }, { status: 500 });
  }
}
