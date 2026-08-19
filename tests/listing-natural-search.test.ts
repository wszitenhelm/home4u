import { describe, expect, it } from "vitest";

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
