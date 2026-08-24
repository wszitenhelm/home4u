import { NextResponse } from "next/server";
import { z } from "zod";

import { parseNaturalListingSearch } from "@/modules/listings/ai/parse-natural-search";
import {
  buildListingSearchHref,
  parseListingSearchParams,
} from "@/modules/listings/queries";
import type { ListingSearchInput } from "@/modules/listings/types";

const naturalSearchQuerySchema = z.string().trim().min(1).max(500);

export async function GET(request: Request): Promise<NextResponse> {
  const requestUrl = new URL(request.url);
  const parsedQuery = naturalSearchQuerySchema.safeParse(requestUrl.searchParams.get("query"));
  const previousNaturalQuery = requestUrl.searchParams.get("previousNaturalQuery")?.trim();
  const explicitFilters = parseListingSearchParams(requestUrl.searchParams);
  const definedExplicitFilters = Object.fromEntries(
    Object.entries(explicitFilters).filter(([, value]) => value !== undefined),
  ) as Partial<ListingSearchInput>;

  const naturalFilters = parsedQuery.success
    ? await parseNaturalListingSearch(parsedQuery.data)
    : {};
  // parseNaturalListingSearch splits the query into structured filters
  // (city/price/rooms/...) plus a leftover fragment that doesn't map to any
  // field (e.g. "nowoczesne" in "nowoczesne mieszkanie w Krakowie"). A
  // non-empty leftover is the signal that semantic ranking should run at
  // all, but the text actually embedded for it is the FULL original query,
  // not just the fragment: a single leftover word embeds too weakly to
  // clear the similarity threshold against any candidate (verified: a bare
  // "nowoczesne" topped out at 0.68, the same query in its full sentence
  // topped out at 0.76) even though it's exactly what the user meant. One
  // search still applies exact filters AND ranks by meaning within them -
  // see getSemanticListingIndex, which falls back to a plain-text search on
  // its own if Gemini/embeddings are unavailable.
  const { q: semanticRemainder, ...structuredNaturalFilters } = naturalFilters;
  const hasSemanticRemainder = (semanticRemainder ?? "").trim().length > 0;
  const naturalFiltersForMerge: Partial<ListingSearchInput> = {
    ...structuredNaturalFilters,
    semanticQuery: hasSemanticRemainder && parsedQuery.success ? parsedQuery.data : undefined,
  };
  const queryChanged =
    parsedQuery.success && parsedQuery.data !== (previousNaturalQuery ?? "");
  const filters = queryChanged
    ? { ...naturalFiltersForMerge, page: 1 }
    : { ...naturalFiltersForMerge, ...definedExplicitFilters, page: 1 };
  const destination = new URL(buildListingSearchHref(filters), requestUrl);

  if (parsedQuery.success) {
    destination.searchParams.set("naturalQuery", parsedQuery.data);
  }

  return NextResponse.redirect(destination);
}
