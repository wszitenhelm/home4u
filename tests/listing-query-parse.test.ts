import { describe, expect, it } from "vitest";

import {
  buildListingSearchHref,
  parseListingSearchParams,
  toggleStringListValue,
} from "@/modules/listings/queries";

describe("listing query parsing", () => {
  it("applies default pagination and sorting", () => {
    const parsed = parseListingSearchParams(new URLSearchParams());

    expect(parsed).toEqual({
      active: true,
      page: 1,
      pageSize: 20,
      sort: "newest",
    });
  });

  it("parses supported filters", () => {
    const parsed = parseListingSearchParams(
      new URLSearchParams({
        q: "kazimierz",
        transactionType: "RENT",
        city: "Kraków",
        district: "Stare Miasto",
        minPrice: "2500",
        maxPrice: "4500",
        minArea: "35.5",
        maxArea: "70",
        minFloor: "1",
        maxFloor: "4",
        rooms: "2",
        features: "BALCONY",
        page: "3",
        pageSize: "10",
        sort: "price_asc",
      }),
    );

    expect(parsed).toEqual({
      q: "kazimierz",
      transactionType: "RENT",
      city: ["Kraków"],
      district: "Stare Miasto",
      minPrice: 2500,
      maxPrice: 4500,
      minArea: 35.5,
      maxArea: 70,
      minFloor: 1,
      maxFloor: 4,
      rooms: 2,
      features: ["BALCONY"],
      active: true,
      page: 3,
      pageSize: 10,
      sort: "price_asc",
    });
  });

  it("parses multiple repeated city params into a single list", () => {
    const parsed = parseListingSearchParams(
      new URLSearchParams([
        ["city", "Kraków"],
        ["city", "Wrocław"],
      ]),
    );

    expect(parsed.city).toEqual(["Kraków", "Wrocław"]);
  });

  it("parses and serializes repeated amenity filters", () => {
    const parsed = parseListingSearchParams(
      new URLSearchParams([
        ["features", "BALCONY"],
        ["features", "ELEVATOR"],
      ]),
    );

    expect(parsed.features).toEqual(["BALCONY", "ELEVATOR"]);
    expect(buildListingSearchHref(parsed)).toContain("features=BALCONY&features=ELEVATOR");
  });

  it("parses and serializes a floor range, including ground floor", () => {
    const parsed = parseListingSearchParams(
      new URLSearchParams({ minFloor: "0", maxFloor: "0" }),
    );

    expect(parsed.minFloor).toBe(0);
    expect(parsed.maxFloor).toBe(0);
    expect(buildListingSearchHref(parsed)).toContain("minFloor=0&maxFloor=0");
  });

  it("preserves filters in pagination hrefs and omits reset defaults", () => {
    expect(
      buildListingSearchHref({
        transactionType: "RENT",
        city: ["Kraków"],
        q: "balkon",
        active: true,
        page: 3,
        pageSize: 20,
        sort: "newest",
      }),
    ).toBe("/listings?q=balkon&transactionType=RENT&city=Krak%C3%B3w&active=true&page=3");

    expect(
      buildListingSearchHref({
        active: true,
        page: 1,
        pageSize: 20,
        sort: "newest",
      }),
    ).toBe("/listings?active=true");
  });

  it("builds an href with repeated city params for multiple selected cities", () => {
    expect(
      buildListingSearchHref({
        city: ["Kraków", "Wrocław"],
        active: true,
        page: 1,
        pageSize: 20,
        sort: "newest",
      }),
    ).toBe("/listings?city=Krak%C3%B3w&city=Wroc%C5%82aw&active=true");
  });

  it("toggles a city in and out of a repeated city filter list", () => {
    expect(toggleStringListValue(undefined, "Kraków")).toEqual(["Kraków"]);
    expect(toggleStringListValue(["Kraków"], "Wrocław")).toEqual(["Kraków", "Wrocław"]);
    expect(toggleStringListValue(["Kraków", "Wrocław"], "Kraków")).toEqual(["Wrocław"]);
    expect(toggleStringListValue(["Kraków"], "Kraków")).toBeUndefined();
  });

  it("rejects an oversized page size", () => {
    expect(() =>
      parseListingSearchParams(new URLSearchParams({ pageSize: "51" })),
    ).toThrow(/Too big/i);
  });

  it("rejects inverted price and area ranges", () => {
    expect(() =>
      parseListingSearchParams(
        new URLSearchParams({
          minPrice: "5000",
          maxPrice: "2000",
          minArea: "80",
          maxArea: "40",
        }),
      ),
    ).toThrow(/minPrice cannot be greater than maxPrice/i);
  });

  it("rejects an inverted floor range", () => {
    expect(() =>
      parseListingSearchParams(new URLSearchParams({ minFloor: "4", maxFloor: "1" })),
    ).toThrow(/minFloor cannot be greater than maxFloor/i);
  });
});
