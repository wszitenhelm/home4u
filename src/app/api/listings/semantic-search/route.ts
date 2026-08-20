import { NextResponse } from "next/server";
import { z } from "zod";

import { buildListingSearchHref, parseListingSearchParams } from "@/modules/listings/queries";

const semanticSearchQuerySchema = z.string().trim().min(1).max(500);

export async function GET(request: Request): Promise<NextResponse> {
  const requestUrl = new URL(request.url);
  const parsedQuery = semanticSearchQuerySchema.safeParse(requestUrl.searchParams.get("query"));
  // Carries over whatever structured filters (transactionType, city, price,
  // rooms, ...) were already active in the submitted form - same discipline
  // as natural-search: a semantic query narrows the current search, it
  // doesn't reset it.
  const explicitFilters = parseListingSearchParams(requestUrl.searchParams);
  const destination = new URL(
    buildListingSearchHref({
      ...explicitFilters,
      semanticQuery: parsedQuery.success ? parsedQuery.data : undefined,
      active: true,
      page: 1,
    }),
    requestUrl,
  );

  return NextResponse.redirect(destination);
}
