import { CatalogueAdminWorkspace, type CatalogueAdminSearchParams } from "../_workspace";

export default function CatalogueAdministrationPage({
  searchParams,
}: { searchParams: Promise<CatalogueAdminSearchParams> }) {
  return <CatalogueAdminWorkspace section="pharmacies" searchParams={searchParams} />;
}
