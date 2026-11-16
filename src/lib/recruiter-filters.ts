import { EMPTY_FILTERS, filtersToQuery, parseFilters, type SearchFilters } from "./search";

/** Query string for a search page, preserving the active filters. */
export function pageQuery(filters: SearchFilters, page?: number): string {
  const base = filtersToQuery(filters);
  if (!page || page <= 1) return base ? `?${base}` : "";
  return `?${base ? `${base}&` : ""}page=${page}`;
}

/** Turn a saved query string (from the search form) into the stored filter object. */
export function filterJsonFromQueryString(query: string): SearchFilters {
  const params = new URLSearchParams(query);
  const obj: Record<string, string | string[]> = {};
  for (const key of new Set(params.keys())) {
    const all = params.getAll(key);
    obj[key] = all.length > 1 ? all : all[0];
  }
  return parseFilters(obj);
}

/** Defensive read of a stored filter object (JSON column). */
export function normalizeFilters(value: unknown): SearchFilters {
  const raw = (value ?? {}) as Partial<SearchFilters>;
  return {
    ...EMPTY_FILTERS,
    modelTypes: Array.isArray(raw.modelTypes) ? raw.modelTypes : [],
    frameworks: Array.isArray(raw.frameworks) ? raw.frameworks : [],
    seniority: Array.isArray(raw.seniority)
      ? raw.seniority.filter((s): s is "junior" | "mid" => s === "junior" || s === "mid")
      : [],
    deployment: raw.deployment === true,
    dataExposure: raw.dataExposure === true,
    minScale:
      raw.minScale === "toy" || raw.minScale === "coursework" || raw.minScale === "production" || raw.minScale === "oss"
        ? raw.minScale
        : null,
    yearsMin: typeof raw.yearsMin === "number" ? raw.yearsMin : null,
    yearsMax: typeof raw.yearsMax === "number" ? raw.yearsMax : null,
    verification:
      raw.verification === "verified_only" || raw.verification === "has_verified"
        ? raw.verification
        : "all",
    q: typeof raw.q === "string" ? raw.q : "",
  };
}

export function describeFilters(filters: SearchFilters): string {
  const parts: string[] = [];
  if (filters.q) parts.push(`“${filters.q}”`);
  if (filters.modelTypes.length) parts.push(filters.modelTypes.join(" / "));
  if (filters.frameworks.length) parts.push(filters.frameworks.join(" / "));
  if (filters.seniority.length) parts.push(filters.seniority.join(" / "));
  if (filters.deployment) parts.push("verified deployment");
  if (filters.dataExposure) parts.push("data exposure");
  if (filters.minScale) parts.push(`${filters.minScale}+ scale`);
  if (filters.yearsMin !== null || filters.yearsMax !== null) {
    parts.push(`${filters.yearsMin ?? 0}–${filters.yearsMax ?? "any"} yrs`);
  }
  if (filters.verification === "has_verified") parts.push("has verified claim");
  if (filters.verification === "verified_only") parts.push("verified-only");
  return parts.length ? parts.join(" · ") : "All profiles";
}
