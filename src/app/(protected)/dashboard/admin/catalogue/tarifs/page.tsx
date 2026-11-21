import { CatalogueAdminWorkspace, type CatalogueAdminSearchParams } from "@/app/catalogue/administration/_workspace";

export default function CatalogueAdminPage({ searchParams }: { searchParams: Promise<CatalogueAdminSearchParams> }) {
  return <CatalogueAdminWorkspace section="tarifs" searchParams={searchParams} />;
}
