type SelectableBrand = { id: string };

export function canSelectBrand(contexts: SelectableBrand[], brandId: unknown): brandId is string {
  return typeof brandId === "string" && contexts.some((brand) => brand.id === brandId);
}
