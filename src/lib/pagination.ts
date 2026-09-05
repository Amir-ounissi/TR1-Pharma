export type SearchParamValues = Record<string, string | string[] | undefined>;

export function buildPageHref(pathname: string, params: SearchParamValues, page: number) {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (key === "page" || value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value]) search.append(key, item);
  }

  search.set("page", String(Math.max(1, page)));
  return `${pathname}?${search.toString()}`;
}
