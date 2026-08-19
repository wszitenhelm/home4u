import { describe, expect, test } from "vitest";

import { rawSourceListingSchema } from "@/modules/ingestion/schemas";
import {
  listingSearchInputSchema,
  normalizedListingSchema,
  paginatedListingResponseSchema,
} from "@/modules/listings/schemas";

describe("listing domain schemas", () => {
  test("parses a raw source listing payload", () => {
    const parsed = rawSourceListingSchema.parse({
      source: "SELECTED_MARKETPLACE",
      sourceUrl: "https://example.test/listing/1",
      sourceListingId: "listing-1",
      title: "Mieszkanie 2-pokojowe",
      description: "Opis oferty",
      transactionTypeHint: "SALE",
      locationText: "Kraków, Krowodrza",
      latitude: 50.0646501,
      longitude: 19.9449799,
      priceText: "699 000 zł",
      attributes: {
        Powierzchnia: "52,7 m²",
        Balkon: "tak",
      },
      photos: ["https://example.test/photo/1.jpg"],
      contactName: "Biuro",
      contactPhone: "+48 500 600 700",
      structuredData: {
        priceCurrency: "PLN",
      },
      rawPayload: {
        source: "fixture",
      },
      contentHash: "hash-1",
      fetchedAt: "2026-08-01T10:00:00.000Z",
      extractionWarnings: [],
    });

    expect(parsed.transactionTypeHint).toBe("SALE");
    expect(parsed.photos).toHaveLength(1);
  });

  test("rejects invalid listing search ranges", () => {
    const result = listingSearchInputSchema.safeParse({
      minPrice: 800000,
      maxPrice: 600000,
    });

    expect(result.success).toBe(false);
  });

  test("rejects an invalid floor range", () => {
    const result = listingSearchInputSchema.safeParse({
      minFloor: 5,
      maxFloor: 1,
    });

    expect(result.success).toBe(false);
  });

  test("accepts ground floor as a valid floor filter", () => {
    const result = listingSearchInputSchema.safeParse({
      minFloor: 0,
      maxFloor: 0,
    });

    expect(result.success).toBe(true);
  });

  test("parses a paginated listing response shape", () => {
    const parsed = paginatedListingResponseSchema.parse({
      items: [
        {
          id: "listing-1",
          source: "SELECTED_MARKETPLACE",
          sourceUrl: "https://example.test/listing/1",
          transactionType: "RENT",
          title: "Do wynajęcia mieszkanie",
          displayTitle: "2 pokoje · 48,5 m² · Wrocław · Krzyki",
          highlights: ["Balkon"],
          priceAmount: "3200.00",
          currency: "PLN",
          administrativeFee: "650.00",
          pricePerSquareMetre: null,
          areaM2: "48.5",
          rooms: 2,
          city: "Wrocław",
          district: "Krzyki",
          street: "Powstańców Śląskich",
          floor: 4,
          publishedAt: "2026-07-20T10:00:00.000Z",
          photo: {
            url: "https://example.test/photo/1.jpg",
            position: 0,
            isPrimary: true,
          },
        },
      ],
      pagination: {
        page: 1,
        pageSize: 20,
        total: 1,
        totalPages: 1,
      },
      appliedFilters: {
        active: true,
        city: ["Wrocław"],
        sort: "newest",
        page: 1,
        pageSize: 20,
      },
    });

    expect(parsed.pagination.total).toBe(1);
  });

  test("accepts normalized listings with decimal strings", () => {
    const parsed = normalizedListingSchema.parse({
      id: "listing-1",
      source: "SELECTED_MARKETPLACE",
      sourceListingId: "listing-1",
      sourceUrl: "https://example.test/listing/1",
      sourceUrlCanonical: "https://example.test/listing/1",
      sourceContentHash: "hash-1",
      propertyType: "APARTMENT",
      transactionType: "SALE",
      publicationStatus: "PUBLISHED",
      rejectionReason: null,
      title: "Mieszkanie testowe",
      descriptionRaw: "Raw",
      descriptionClean: "Clean",
      descriptionSummary: null,
      priceAmount: "699000.00",
      currency: "PLN",
      administrativeFee: null,
      depositAmount: null,
      utilitiesDescription: null,
      areaM2: "52.7",
      rooms: 3,
      city: "Kraków",
      district: "Krowodrza",
      street: null,
      latitude: 50.0646501,
      longitude: 19.9449799,
      floor: 3,
      floorCount: 5,
      buildingYear: 2018,
      marketType: "wtórny",
      ownershipType: "pełna własność",
      buildingType: "blok",
      heatingType: "miejskie",
      condition: "do zamieszkania",
      sellerType: "biuro nieruchomości",
      availableFrom: null,
      sourcePublishedAt: "2026-07-15T10:00:00.000Z",
      sourceUpdatedAt: "2026-07-16T10:00:00.000Z",
      scrapedAt: "2026-07-17T10:00:00.000Z",
      contactName: "Biuro",
      contactPhone: null,
      rawAttributes: {},
      rawPayload: {},
      qualityScore: 90,
      completenessScore: 88,
      consistencyScore: 92,
      duplicateGroupId: null,
      isPrimary: true,
      photos: [],
      features: [],
    });

    expect(parsed.areaM2).toBe("52.7");
  });
});
