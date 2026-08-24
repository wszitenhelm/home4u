import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { createListingService } from "@/modules/listings/service";
import type { ListingRecord, ListingRepository } from "@/modules/listings/types";

const { generateEmbedding } = vi.hoisted(() => ({ generateEmbedding: vi.fn() }));

vi.mock("@/modules/listings/ai/embeddings", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/listings/ai/embeddings")>()),
  generateEmbedding,
}));

function createListingRecord(
  overrides: Partial<ListingRecord> = {},
): ListingRecord {
  return {
    id: "listing-1",
    source: "SELECTED_MARKETPLACE",
    sourceUrl: "https://example.com/listing-1",
    transactionType: "SALE",
    title: "Nowe mieszkanie w centrum",
    descriptionClean: "Jasne mieszkanie w Krakowie.",
    descriptionSummary: null,
    priceAmount: new Prisma.Decimal("750000.00"),
    currency: "PLN",
    administrativeFee: new Prisma.Decimal("850.00"),
    depositAmount: null,
    utilitiesDescription: "ogrzewanie miejskie",
    areaM2: new Prisma.Decimal("50.00"),
    rooms: 2,
    city: "Kraków",
    district: "Stare Miasto",
    street: "Dietla",
    latitude: new Prisma.Decimal("50.0646501"),
    longitude: new Prisma.Decimal("19.9449799"),
    floor: 3,
    floorCount: 5,
    buildingYear: 2018,
    marketType: "wtórny",
    ownershipType: "pełna własność",
    buildingType: "blok",
    condition: "dobry",
    sellerType: "AGENCY",
    availableFrom: new Date("2026-08-15T00:00:00.000Z"),
    sourcePublishedAt: new Date("2026-08-01T09:00:00.000Z"),
    sourceUpdatedAt: new Date("2026-08-01T10:00:00.000Z"),
    contactName: "Biuro Centrum",
    contactPhone: "+48500600700",
    createdAt: new Date("2026-08-01T08:00:00.000Z"),
    photos: [
      {
        url: "https://example.com/photo-1.jpg",
        position: 0,
        isPrimary: true,
      },
    ],
    features: [
      {
        key: "BALCONY",
        valueType: "BOOLEAN",
        booleanValue: true,
        numberValue: null,
        textValue: null,
        rawValue: "tak",
      },
    ],
    ...overrides,
  };
}

function createRepositoryMock(
  overrides: Partial<ListingRepository> = {},
): ListingRepository {
  return {
    findPublicListings: vi.fn().mockResolvedValue({ total: 0, items: [] }),
    findPublicListingById: vi.fn().mockResolvedValue(null),
    findPublishedListingEmbeddings: vi.fn().mockResolvedValue([]),
    findPublicListingsByIds: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

describe("listing service", () => {
  it("maps paginated listing results", async () => {
    const repository = createRepositoryMock({
      findPublicListings: vi.fn().mockResolvedValue({
        total: 1,
        items: [createListingRecord()],
      }),
    });
    const service = createListingService(repository);

    const result = await service.getListingIndex({
      city: ["Kraków"],
      active: true,
      page: 2,
      pageSize: 1,
      sort: "newest",
    });

    expect(result.pagination).toEqual({
      page: 2,
      pageSize: 1,
      total: 1,
      totalPages: 1,
    });
    expect(result.items[0]).toMatchObject({
      id: "listing-1",
      city: "Kraków",
      priceAmount: "750000.00",
      administrativeFee: "850.00",
      pricePerSquareMetre: "15000.00",
    });
  });

  it("returns null for hidden or missing details", async () => {
    const service = createListingService(createRepositoryMock());

    await expect(service.getListingDetail("missing")).resolves.toBeNull();
  });

  it("returns a valid public detail response", async () => {
    const repository = createRepositoryMock({
      findPublicListingById: vi.fn().mockResolvedValue(
        createListingRecord({
          transactionType: "RENT",
          priceAmount: new Prisma.Decimal("4200.00"),
          areaM2: new Prisma.Decimal("60.00"),
        }),
      ),
    });
    const service = createListingService(repository);

    const result = await service.getListingDetail("listing-1");

    expect(result).not.toBeNull();
    expect(result).toMatchObject({
      id: "listing-1",
      transactionType: "RENT",
      priceAmount: "4200.00",
      administrativeFee: "850.00",
      pricePerSquareMetre: null,
      depositAmount: null,
      utilitiesDescription: "ogrzewanie miejskie",
      description: "Jasne mieszkanie w Krakowie.",
      contactName: "Biuro Centrum",
      contactPhone: "+48500600700",
      photos: [
        {
          url: "https://example.com/photo-1.jpg",
          position: 0,
          isPrimary: true,
        },
      ],
    });
    expect(result).not.toHaveProperty("rawPayload");
    expect(result).not.toHaveProperty("rawAttributes");
  });

  describe("semantic search", () => {
    it("delegates to plain listing search when no semantic query is present", async () => {
      const findPublicListings = vi.fn().mockResolvedValue({ total: 0, items: [] });
      const service = createListingService(createRepositoryMock({ findPublicListings }));

      await service.getSemanticListingIndex({
        active: true,
        page: 1,
        pageSize: 20,
        sort: "newest",
      });

      expect(findPublicListings).toHaveBeenCalledOnce();
      expect(generateEmbedding).not.toHaveBeenCalled();
    });

    it("falls back to plain-text search when the embedding call is unavailable", async () => {
      generateEmbedding.mockResolvedValueOnce(null);
      const findPublicListings = vi.fn().mockResolvedValue({ total: 0, items: [] });
      const service = createListingService(createRepositoryMock({ findPublicListings }));

      await service.getSemanticListingIndex({
        semanticQuery: "przytulne mieszkanie z balkonem",
        active: true,
        page: 1,
        pageSize: 20,
        sort: "newest",
      });

      expect(findPublicListings).toHaveBeenCalledWith(
        expect.objectContaining({ q: "przytulne mieszkanie z balkonem", semanticQuery: undefined }),
      );
    });

    it("falls back to plain-text search when there are no listing embeddings yet", async () => {
      generateEmbedding.mockResolvedValueOnce([1, 0, 0]);
      const findPublicListings = vi.fn().mockResolvedValue({ total: 0, items: [] });
      const service = createListingService(
        createRepositoryMock({
          findPublicListings,
          findPublishedListingEmbeddings: vi.fn().mockResolvedValue([]),
        }),
      );

      await service.getSemanticListingIndex({
        semanticQuery: "balkon",
        active: true,
        page: 1,
        pageSize: 20,
        sort: "newest",
      });

      expect(findPublicListings).toHaveBeenCalledOnce();
    });

    it("ranks listings by cosine similarity and filters out low-similarity matches", async () => {
      generateEmbedding.mockResolvedValueOnce([1, 0, 0]);
      const findPublicListingsByIds = vi.fn().mockResolvedValue([
        createListingRecord({ id: "close-match" }),
        createListingRecord({ id: "exact-match" }),
      ]);
      const service = createListingService(
        createRepositoryMock({
          findPublishedListingEmbeddings: vi.fn().mockResolvedValue([
            { id: "exact-match", embedding: [1, 0, 0] },
            { id: "close-match", embedding: [0.9, 0.1, 0] },
            { id: "unrelated", embedding: [0, 1, 0] },
          ]),
          findPublicListingsByIds,
        }),
      );

      const result = await service.getSemanticListingIndex({
        semanticQuery: "balkon w centrum",
        active: true,
        page: 1,
        pageSize: 20,
        sort: "newest",
      });

      // Only exact-match and close-match clear the similarity threshold;
      // the fully orthogonal "unrelated" vector (score 0) does not.
      expect(findPublicListingsByIds).toHaveBeenCalledWith(["exact-match", "close-match"]);
      expect(result.pagination.total).toBe(2);
      expect(result.items.map((item) => item.id)).toEqual(["exact-match", "close-match"]);
    });

    it("ranks only within the currently active structured filters, not the whole catalog", async () => {
      generateEmbedding.mockResolvedValueOnce([1, 0, 0]);
      const findPublishedListingEmbeddings = vi.fn().mockResolvedValue([]);
      const service = createListingService(
        createRepositoryMock({
          findPublishedListingEmbeddings,
          findPublicListings: vi.fn().mockResolvedValue({ total: 0, items: [] }),
        }),
      );

      await service.getSemanticListingIndex({
        semanticQuery: "balkon w centrum",
        transactionType: "RENT",
        city: ["Kraków"],
        maxPrice: 4000,
        active: true,
        page: 1,
        pageSize: 20,
        sort: "newest",
      });

      expect(findPublishedListingEmbeddings).toHaveBeenCalledWith(
        expect.objectContaining({
          transactionType: "RENT",
          city: ["Kraków"],
          maxPrice: 4000,
        }),
      );
    });
  });
});
