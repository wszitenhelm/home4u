import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { parseNaturalSearchLocally } from "@/modules/listings/ai/parse-natural-search";

describe("natural listing search", () => {
  it("understands the example English request", () => {
    expect(parseNaturalSearchLocally("I want a flat to rent in Krakow 30m with balcony")).toMatchObject({
      transactionType: "RENT",
      cities: ["Kraków"],
      minArea: 25,
      maxArea: 35,
      features: ["BALCONY"],
    });
  });

  it("understands a Polish request with a one-sided area and rooms", () => {
    expect(
      parseNaturalSearchLocally(
        "Szukam mieszkania na sprzedaż we Wrocławiu, co najmniej 45 m2, 2 pokoje i winda",
      ),
    ).toMatchObject({
      transactionType: "SALE",
      cities: ["Wrocław"],
      minArea: 45,
      maxArea: null,
      rooms: 2,
      features: ["ELEVATOR"],
    });
  });

  it("understands a Polish maximum monthly price", () => {
    expect(
      parseNaturalSearchLocally("Chcę wynająć mieszkanie w Krakowie z balkonem do 4000 zł"),
    ).toMatchObject({
      transactionType: "RENT",
      cities: ["Kraków"],
      maxPrice: 4000,
      features: ["BALCONY"],
    });
  });

  it("understands an exact floor and a garage request", () => {
    expect(
      parseNaturalSearchLocally("Mieszkanie na 4 piętrze w Gdańsku z garażem"),
    ).toMatchObject({
      cities: ["Gdańsk"],
      minFloor: 4,
      maxFloor: 4,
      features: ["GARAGE"],
    });
  });

  it("understands a one-sided minimum floor phrased as 'or higher'", () => {
    expect(parseNaturalSearchLocally("Mieszkanie na sprzedaż, 3 piętro lub wyżej")).toMatchObject({
      transactionType: "SALE",
      minFloor: 3,
      maxFloor: null,
    });
  });

  it("understands 'od' as a one-sided minimum floor", () => {
    expect(parseNaturalSearchLocally("Szukam mieszkania od 2 piętra")).toMatchObject({
      minFloor: 2,
      maxFloor: null,
    });
  });

  it("understands a one-sided maximum floor", () => {
    expect(parseNaturalSearchLocally("Mieszkanie do 3 piętra z parkingiem")).toMatchObject({
      minFloor: null,
      maxFloor: 3,
      features: ["PARKING"],
    });
  });

  it("understands parter as ground floor", () => {
    expect(parseNaturalSearchLocally("Mieszkanie na parterze")).toMatchObject({
      minFloor: 0,
      maxFloor: 0,
    });
  });
});

// These tests must never hit the real Gemini API, even though the local
// .env used by the test setup may contain a real key: @/shared/env is
// mocked per-test so behavior is independent of whatever is actually in the
// developer's local .env, and global.fetch is mocked/spied so no network
// call can occur even if that mock were wrong. Same convention as
// tests/ingestion-ai-summary.test.ts.
describe("parseNaturalListingSearch (Gemini call site)", () => {
  // resetModules runs both before and after: the module under test was
  // already loaded once by parseNaturalSearchLocally's static import above,
  // so the very first test here also needs a fresh module graph for its
  // env mock to take effect, not just the tests after it.
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it("never calls fetch when no API key is configured", async () => {
    vi.doMock("@/shared/env", () => ({
      env: { GEMINI_API_KEY: undefined, GEMINI_MODEL: "gemini-2.5-flash" },
    }));
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const { parseNaturalListingSearch } = await import(
      "@/modules/listings/ai/parse-natural-search"
    );

    await parseNaturalListingSearch("mieszkanie w Krakowie");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("logs one structured success event on a well-formed response", async () => {
    vi.doMock("@/shared/env", () => ({
      env: { GEMINI_API_KEY: "test-key", GEMINI_MODEL: "gemini-2.5-flash" },
    }));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        transactionType: "RENT",
                        cities: ["Kraków"],
                        district: null,
                        minPrice: null,
                        maxPrice: null,
                        minArea: null,
                        maxArea: null,
                        minFloor: null,
                        maxFloor: null,
                        rooms: null,
                        features: [],
                        q: null,
                      }),
                    },
                  ],
                },
              },
            ],
          }),
      }),
    );
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const { parseNaturalListingSearch } = await import(
      "@/modules/listings/ai/parse-natural-search"
    );

    await parseNaturalListingSearch("mieszkanie w Krakowie");

    expect(errorSpy).not.toHaveBeenCalled();
    expect(infoSpy).toHaveBeenCalledTimes(1);
    expect(infoSpy).toHaveBeenCalledWith(
      "ai-call",
      expect.objectContaining({
        event: "parse_natural_search",
        success: true,
        fallbackTriggered: false,
        model: "gemini-2.5-flash",
        durationMs: expect.any(Number),
      }),
    );
  });

  it("logs one structured failure event when the HTTP response is not ok", async () => {
    vi.doMock("@/shared/env", () => ({
      env: { GEMINI_API_KEY: "test-key", GEMINI_MODEL: "gemini-2.5-flash" },
    }));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const { parseNaturalListingSearch } = await import(
      "@/modules/listings/ai/parse-natural-search"
    );

    await parseNaturalListingSearch("mieszkanie w Krakowie");

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(
      "ai-call",
      expect.objectContaining({
        event: "parse_natural_search",
        success: false,
        fallbackTriggered: true,
        model: "gemini-2.5-flash",
        detail: "HTTP 500",
      }),
    );
  });
});
