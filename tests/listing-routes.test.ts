import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

describe("GET /api/listings", () => {
  it("returns invalid query errors", async () => {
    const { GET } = await import("@/app/api/listings/route");

    const response = await GET(new Request("http://localhost/api/listings?pageSize=99"));
    const body = (await response.json()) as {
      message: string;
      issues: Array<{ path: string; message: string }>;
    };

    expect(response.status).toBe(400);
    expect(body.message).toBe("Invalid listing query.");
    expect(body.issues[0]?.path).toBe("pageSize");
  });

  it("returns paginated public listings", async () => {
    vi.doMock("@/modules/listings/service", () => ({
      getListingIndex: vi.fn().mockResolvedValue({
        items: [
          {
            id: "listing-1",
            title: "Mieszkanie w centrum",
            displayTitle: "2 pokoje · 50 m² · Kraków · Stare Miasto",
            highlights: [],
            transactionType: "SALE",
            source: "SELECTED_MARKETPLACE",
            sourceUrl: "https://example.com/listing-1",
            priceAmount: "750000.00",
            currency: "PLN",
            administrativeFee: null,
            pricePerSquareMetre: "15000.00",
            areaM2: "50.00",
            rooms: 2,
            city: "Kraków",
            district: "Stare Miasto",
            street: "Dietla",
            floor: 2,
            publishedAt: "2026-08-01T09:00:00.000Z",
            photo: null,
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
          page: 1,
          pageSize: 20,
          sort: "newest",
        },
      }),
    }));

    const { GET } = await import("@/app/api/listings/route");
    const response = await GET(new Request("http://localhost/api/listings"));
    const body = (await response.json()) as {
      items: Array<{ id: string }>;
      pagination: { total: number };
    };

    expect(response.status).toBe(200);
    expect(body.items).toHaveLength(1);
    expect(body.pagination.total).toBe(1);
  });

  it("returns an internal error without leaking details", async () => {
    vi.doMock("@/modules/listings/service", () => ({
      getListingIndex: vi.fn().mockRejectedValue(new Error("database exploded")),
    }));

    const { GET } = await import("@/app/api/listings/route");
    const response = await GET(new Request("http://localhost/api/listings"));

    expect(response.status).toBe(500);
    await expect(response.text()).resolves.toContain("Failed to load listings.");
  });
});

describe("GET /api/listings/natural-search", () => {
  it("redirects a natural query to parsed listing filters", async () => {
    vi.doMock("@/modules/listings/ai/parse-natural-search", () => ({
      parseNaturalListingSearch: vi.fn().mockResolvedValue({
        transactionType: "RENT",
        city: ["Kraków"],
      }),
    }));

    const { GET } = await import("@/app/api/listings/natural-search/route");
    const response = await GET(
      new Request(
        "http://localhost/api/listings/natural-search?query=chce%20wynaj%C4%85%C4%87%20mieszkanie%20w%20Krakowie",
      ),
    );
    const location = response.headers.get("location");

    expect(response.status).toBe(307);
    expect(location).toContain("transactionType=RENT");
    expect(location).toContain("city=Krak%C3%B3w");
    expect(location).toContain("naturalQuery=chce+");
  });

  it("runs semantic ranking on the full original query when a leftover fragment exists, not q", async () => {
    vi.doMock("@/modules/listings/ai/parse-natural-search", () => ({
      parseNaturalListingSearch: vi.fn().mockResolvedValue({
        transactionType: "RENT",
        city: ["Kraków"],
        q: "nowoczesne",
      }),
    }));

    const { GET } = await import("@/app/api/listings/natural-search/route");
    const response = await GET(
      new Request(
        "http://localhost/api/listings/natural-search?query=chce%20wynaj%C4%85%C4%87%20nowoczesne%20mieszkanie%20w%20Krakowie",
      ),
    );
    const location = response.headers.get("location");

    // The full sentence, not the bare "nowoczesne" fragment: a single
    // leftover word embeds too weakly to clear the similarity threshold.
    expect(location).toContain(
      "semanticQuery=chce+wynaj%C4%85%C4%87+nowoczesne+mieszkanie+w+Krakowie",
    );
    expect(location).not.toMatch(/[?&]q=/);
  });

  it("does not trigger semantic ranking when the query fully maps to structured filters", async () => {
    vi.doMock("@/modules/listings/ai/parse-natural-search", () => ({
      parseNaturalListingSearch: vi.fn().mockResolvedValue({
        transactionType: "RENT",
        city: ["Kraków"],
        rooms: 3,
        q: undefined,
      }),
    }));

    const { GET } = await import("@/app/api/listings/natural-search/route");
    const response = await GET(
      new Request(
        "http://localhost/api/listings/natural-search?query=3%20pokoje%20w%20Krakowie%20na%20wynajem",
      ),
    );
    const location = response.headers.get("location");

    expect(location).not.toMatch(/[?&]semanticQuery=/);
    expect(location).toContain("rooms=3");
  });

  it("preserves explicit filters when the natural query is blank", async () => {
    const { GET } = await import("@/app/api/listings/natural-search/route");
    const response = await GET(
      new Request(
        "http://localhost/api/listings/natural-search?query=&city=Gda%C5%84sk&maxPrice=5000",
      ),
    );
    const location = response.headers.get("location");

    expect(response.status).toBe(307);
    expect(location).toContain("city=Gda%C5%84sk");
    expect(location).toContain("maxPrice=5000");
  });

  it("does not let stale explicit filters override a changed natural query", async () => {
    vi.doMock("@/modules/listings/ai/parse-natural-search", () => ({
      parseNaturalListingSearch: vi.fn().mockResolvedValue({
        transactionType: "RENT",
        city: ["Wrocław"],
      }),
    }));

    const { GET } = await import("@/app/api/listings/natural-search/route");
    const response = await GET(
      new Request(
        "http://localhost/api/listings/natural-search?query=wynajem+we+Wroc%C5%82awiu&previousNaturalQuery=wynajem+w+Krakowie&city=Krak%C3%B3w&features=BALCONY",
      ),
    );
    const location = response.headers.get("location");

    expect(location).toContain("city=Wroc%C5%82aw");
    expect(location).not.toContain("city=Krak%C3%B3w");
    expect(location).not.toContain("features=BALCONY");
  });
});

describe("GET /api/listings/[id]", () => {
  it("returns 400 for an invalid identifier", async () => {
    const { GET } = await import("@/app/api/listings/[id]/route");
    const response = await GET(new Request("http://localhost/api/listings/%20"), {
      params: Promise.resolve({ id: " " }),
    });

    expect(response.status).toBe(400);
    await expect(response.text()).resolves.toContain("Invalid listing identifier.");
  });

  it("returns 404 when the public listing is not found", async () => {
    vi.doMock("@/modules/listings/service", () => ({
      getListingDetail: vi.fn().mockResolvedValue(null),
    }));

    const { GET } = await import("@/app/api/listings/[id]/route");
    const response = await GET(new Request("http://localhost/api/listings/listing-1"), {
      params: Promise.resolve({ id: "listing-1" }),
    });

    expect(response.status).toBe(404);
    await expect(response.text()).resolves.toContain("Listing not found.");
  });

  it("returns the public listing detail DTO", async () => {
    vi.doMock("@/modules/listings/service", () => ({
      getListingDetail: vi.fn().mockResolvedValue({
        id: "listing-1",
        title: "Mieszkanie w centrum",
        displayTitle: "2 pokoje · 60 m² · Kraków · Krowodrza",
        highlights: [],
        transactionType: "RENT",
        source: "SELECTED_MARKETPLACE",
        sourceUrl: "https://example.com/listing-1",
        priceAmount: "4200.00",
        currency: "PLN",
        administrativeFee: "800.00",
        pricePerSquareMetre: null,
        areaM2: "60.00",
        rooms: 2,
        city: "Kraków",
        district: "Krowodrza",
        street: "Zbożowa",
        floor: 1,
        publishedAt: "2026-08-01T09:00:00.000Z",
        photo: {
          url: "https://example.com/photo-1.jpg",
          position: 0,
          isPrimary: true,
        },
        description: "Przestronne mieszkanie.",
        aiSummary: null,
        latitude: 50.0646501,
        longitude: 19.9449799,
        depositAmount: null,
        utilitiesDescription: null,
        floorCount: 4,
        buildingYear: 2020,
        marketType: null,
        ownershipType: null,
        buildingType: "apartamentowiec",
        condition: "bardzo dobry",
        sellerType: "AGENCY",
        contactName: null,
        contactPhone: null,
        availableFrom: "2026-08-10T00:00:00.000Z",
        updatedAt: "2026-08-01T10:00:00.000Z",
        photos: [
          {
            url: "https://example.com/photo-1.jpg",
            position: 0,
            isPrimary: true,
          },
        ],
        features: [],
      }),
    }));

    const { GET } = await import("@/app/api/listings/[id]/route");
    const response = await GET(new Request("http://localhost/api/listings/listing-1"), {
      params: Promise.resolve({ id: "listing-1" }),
    });
    const body = (await response.json()) as { id: string; administrativeFee: string };

    expect(response.status).toBe(200);
    expect(body.id).toBe("listing-1");
    expect(body.administrativeFee).toBe("800.00");
  });
});
