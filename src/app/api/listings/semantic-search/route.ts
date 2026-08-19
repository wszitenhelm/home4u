import { NextResponse } from "next/server";
import { z } from "zod";

const semanticSearchQuerySchema = z.string().trim().min(1).max(500);

export async function GET(request: Request): Promise<NextResponse> {
  const requestUrl = new URL(request.url);
  const parsedQuery = semanticSearchQuerySchema.safeParse(requestUrl.searchParams.get("query"));
  const destination = new URL("/listings", requestUrl);

  destination.searchParams.set("active", "true");

  if (parsedQuery.success) {
    destination.searchParams.set("semanticQuery", parsedQuery.data);
  }

  return NextResponse.redirect(destination);
}
