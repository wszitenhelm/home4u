import { listingSearchInputSchema } from "@/modules/listings/schemas";
import type { ListingSearchInput } from "@/modules/listings/types";

export function parseListingSearchParams(searchParams: URLSearchParams): ListingSearchInput {
  return listingSearchInputSchema.parse({
    q: searchParams.get("q") ?? undefined,
    transactionType: searchParams.get("transactionType") ?? undefined,
    city: searchParams.getAll("city"),
    district: searchParams.get("district") ?? undefined,
    minPrice: searchParams.get("minPrice") ?? undefined,
    maxPrice: searchParams.get("maxPrice") ?? undefined,
    minArea: searchParams.get("minArea") ?? undefined,
    maxArea: searchParams.get("maxArea") ?? undefined,
    minFloor: searchParams.get("minFloor") ?? undefined,
    maxFloor: searchParams.get("maxFloor") ?? undefined,
    rooms: searchParams.get("rooms") ?? undefined,
    features: searchParams.getAll("features"),
    active: searchParams.get("active") ?? undefined,
    page: searchParams.get("page") ?? undefined,
    pageSize: searchParams.get("pageSize") ?? undefined,
    sort: searchParams.get("sort") ?? undefined,
  });
}

export function createSearchParamsFromObject(
  input: Record<string, string | string[] | undefined>,
): URLSearchParams {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(input)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item !== undefined) {
          searchParams.append(key, item);
        }
      }

      continue;
    }

    if (value !== undefined) {
      searchParams.set(key, value);
    }
  }

  return searchParams;
}

export function searchParamsToInput(
  input: Record<string, string | string[] | undefined>,
): ListingSearchInput {
  return parseListingSearchParams(createSearchParamsFromObject(input));
}

export function buildListingSearchHref(input: Partial<ListingSearchInput>): string {
  const searchParams = new URLSearchParams();

  if (input.q !== undefined) {
    searchParams.set("q", input.q);
  }

  if (input.transactionType !== undefined) {
    searchParams.set("transactionType", input.transactionType);
  }

  if (input.city !== undefined) {
    for (const city of input.city) {
      searchParams.append("city", city);
    }
  }

  if (input.district !== undefined) {
    searchParams.set("district", input.district);
  }

  if (input.minPrice !== undefined) {
    searchParams.set("minPrice", String(input.minPrice));
  }

  if (input.maxPrice !== undefined) {
    searchParams.set("maxPrice", String(input.maxPrice));
  }

  if (input.minArea !== undefined) {
    searchParams.set("minArea", String(input.minArea));
  }

  if (input.maxArea !== undefined) {
    searchParams.set("maxArea", String(input.maxArea));
  }

  if (input.minFloor !== undefined) {
    searchParams.set("minFloor", String(input.minFloor));
  }

  if (input.maxFloor !== undefined) {
    searchParams.set("maxFloor", String(input.maxFloor));
  }

  if (input.rooms !== undefined) {
    searchParams.set("rooms", String(input.rooms));
  }

  if (input.features !== undefined) {
    for (const feature of input.features) {
      searchParams.append("features", feature);
    }
  }

  if (input.active !== undefined) {
    searchParams.set("active", String(input.active));
  }

  if (input.page !== undefined && input.page !== 1) {
    searchParams.set("page", String(input.page));
  }

  if (input.pageSize !== undefined && input.pageSize !== 20) {
    searchParams.set("pageSize", String(input.pageSize));
  }

  if (input.sort !== undefined && input.sort !== "newest") {
    searchParams.set("sort", input.sort);
  }

  const query = searchParams.toString();

  return query.length === 0 ? "/listings" : `/listings?${query}`;
}

export function toggleStringListValue(
  values: readonly string[] | undefined,
  value: string,
): string[] | undefined {
  const currentValues = values ?? [];

  if (currentValues.includes(value)) {
    const nextValues = currentValues.filter((item) => item !== value);

    return nextValues.length > 0 ? nextValues : undefined;
  }

  return [...currentValues, value];
}
