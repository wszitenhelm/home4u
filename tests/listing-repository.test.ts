import { describe, expect, it, vi } from "vitest";

import {
  buildOrderBy,
  buildPublicListingWhere,
  createListingRepository,
} from "@/modules/listings/repository";

describe("listing repository", () => {
  it("always filters to published primary listings", () => {
    const where = buildPublicListingWhere({
      active: true,
      page: 1,
      pageSize: 20,
      sort: "newest",
    });

    expect(where).toMatchObject({
      publicationStatus: "PUBLISHED",
      isPrimary: true,
    });
  });

  it("builds text search across public fields", () => {
    const where = buildPublicListingWhere({
      q: "bronowice",
      active: true,
      page: 1,
      pageSize: 20,
      sort: "newest",
    });

    expect(where.AND).toEqual([
      {
        OR: [
          { title: { contains: "bronowice" } },
          { descriptionClean: { contains: "bronowice" } },
          { city: { contains: "bronowice" } },
          { district: { contains: "bronowice" } },
          { street: { contains: "bronowice" } },
        ],
      },
    ]);
  });

  it("builds individual structured filters", () => {
    const where = buildPublicListingWhere({
      transactionType: "SALE",
      city: ["Kraków"],
      district: "Krowodrza",
      minPrice: 500000,
      maxPrice: 900000,
      minArea: 40,
      maxArea: 80,
      minFloor: 1,
      maxFloor: 5,
      rooms: 3,
      active: true,
      page: 1,
      pageSize: 20,
      sort: "newest",
    });

    expect(where).toMatchObject({
      transactionType: "SALE",
      city: { in: ["Kraków"] },
      district: { equals: "Krowodrza" },
      rooms: 3,
      priceAmount: { gte: 500000, lte: 900000 },
      areaM2: { gte: 40, lte: 80 },
      floor: { gte: 1, lte: 5 },
    });
  });

  it("builds a one-sided floor filter, including ground floor", () => {
    const where = buildPublicListingWhere({
      minFloor: 0,
      maxFloor: 0,
      active: true,
      page: 1,
      pageSize: 20,
      sort: "newest",
    });

    expect(where).toMatchObject({
      floor: { gte: 0, lte: 0 },
    });
  });

  it("builds a city filter matching multiple cities at once", () => {
    const where = buildPublicListingWhere({
      city: ["Kraków", "Wrocław"],
      active: true,
      page: 1,
      pageSize: 20,
      sort: "newest",
    });

    expect(where).toMatchObject({
      city: { in: ["Kraków", "Wrocław"] },
    });
  });

  it("requires every requested amenity", () => {
    const where = buildPublicListingWhere({
      features: ["BALCONY", "ELEVATOR"],
      active: true,
      page: 1,
      pageSize: 20,
      sort: "newest",
    });

    expect(where.AND).toEqual([
      {
        OR: [
          { features: { some: { key: "BALCONY", booleanValue: true } } },
          { title: { contains: "balkon" } },
          { descriptionClean: { contains: "balkon" } },
        ],
      },
      {
        OR: [
          { features: { some: { key: "ELEVATOR", booleanValue: true } } },
          { title: { contains: "winda" } },
          { descriptionClean: { contains: "winda" } },
        ],
      },
    ]);
  });

  it("builds combined filters together", () => {
    const where = buildPublicListingWhere({
      q: "centrum",
      transactionType: "RENT",
      city: ["Warszawa"],
      district: "Śródmieście",
      minPrice: 3000,
      maxPrice: 6000,
      minArea: 30,
      maxArea: 60,
      rooms: 2,
      active: true,
      page: 2,
      pageSize: 10,
      sort: "price_desc",
    });

    expect(where).toMatchObject({
      publicationStatus: "PUBLISHED",
      isPrimary: true,
      transactionType: "RENT",
      city: { in: ["Warszawa"] },
      district: { equals: "Śródmieście" },
      rooms: 2,
      priceAmount: { gte: 3000, lte: 6000 },
      areaM2: { gte: 30, lte: 60 },
    });
    expect(where.AND).toHaveLength(1);
  });

  it.each([
    ["newest", [{ sourcePublishedAt: "desc" }, { createdAt: "desc" }, { id: "asc" }]],
    ["price_asc", [{ priceAmount: "asc" }, { id: "asc" }]],
    ["price_desc", [{ priceAmount: "desc" }, { id: "asc" }]],
    ["area_asc", [{ areaM2: "asc" }, { id: "asc" }]],
    ["area_desc", [{ areaM2: "desc" }, { id: "asc" }]],
  ] as const)("builds %s sort order", (sort, expected) => {
    expect(buildOrderBy(sort)).toEqual(expected);
  });

  it("passes pagination to Prisma", async () => {
    const count = vi.fn().mockResolvedValue(0);
    const findMany = vi.fn().mockResolvedValue([]);
    const findFirst = vi.fn();
    const repository = createListingRepository({
      count,
      findMany,
      findFirst,
    } as never);

    const result = await repository.findPublicListings({
      active: true,
      page: 3,
      pageSize: 20,
      sort: "newest",
    });

    expect(result).toEqual({ total: 0, items: [] });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 40,
        take: 20,
      }),
    );
  });

  it("returns empty results without error", async () => {
    const repository = createListingRepository({
      count: vi.fn().mockResolvedValue(0),
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn(),
    } as never);

    await expect(
      repository.findPublicListings({
        active: true,
        page: 1,
        pageSize: 20,
        sort: "newest",
      }),
    ).resolves.toEqual({
      total: 0,
      items: [],
    });
  });

  it("filters candidate embeddings by the same structured criteria as findPublicListings", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const repository = createListingRepository({
      count: vi.fn(),
      findMany,
      findFirst: vi.fn(),
    } as never);

    await repository.findPublishedListingEmbeddings({
      active: true,
      transactionType: "RENT",
      city: ["Kraków"],
      maxPrice: 4000,
      page: 1,
      pageSize: 20,
      sort: "newest",
    });

    expect(findMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        publicationStatus: "PUBLISHED",
        isPrimary: true,
        transactionType: "RENT",
        city: { in: ["Kraków"] },
        priceAmount: { gte: undefined, lte: 4000 },
      }),
      select: { id: true, embedding: true },
    });
  });

  it("hides rejected, needs-review, and duplicate variants in detail lookup", async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const repository = createListingRepository({
      count: vi.fn(),
      findMany: vi.fn(),
      findFirst,
    } as never);

    await repository.findPublicListingById("listing-123");

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "listing-123",
          publicationStatus: "PUBLISHED",
          isPrimary: true,
        },
      }),
    );
  });
});
