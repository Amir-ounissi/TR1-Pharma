import AdminConditions from "@/app/catalogue/administration/conditions/_view";

export default function CatalogueAdminConditionsPage(props: { searchParams: Promise<{ enregistre?: string }> }) {
  return <AdminConditions searchParams={props.searchParams}/>;
}
