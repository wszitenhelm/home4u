import { describe, expect, it } from "vitest";

import {
  buildListingEmbeddingText,
  cosineSimilarity,
} from "@/modules/listings/ai/embeddings";

describe("cosineSimilarity", () => {
  it("returns 1 for identical vectors", () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1);
  });

  it("returns 0 for orthogonal vectors", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it("returns -1 for opposite vectors", () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1);
  });

  it("returns 0 for mismatched lengths instead of throwing", () => {
    expect(cosineSimilarity([1, 2], [1, 2, 3])).toBe(0);
  });

  it("returns 0 for empty vectors instead of dividing by zero", () => {
    expect(cosineSimilarity([], [])).toBe(0);
  });
});

describe("buildListingEmbeddingText", () => {
  it("joins title, description, and feature lines", () => {
    expect(
      buildListingEmbeddingText({
        title: "Mieszkanie w centrum",
        descriptionClean: "Jasne, przestronne wnętrze.",
        featureLines: ["Balkon", "Winda"],
      }),
    ).toBe("Mieszkanie w centrum. Jasne, przestronne wnętrze.. Balkon. Winda");
  });

  it("skips null and empty fields", () => {
    expect(
      buildListingEmbeddingText({
        title: "Mieszkanie",
        descriptionClean: null,
        featureLines: [],
      }),
    ).toBe("Mieszkanie");
  });

  it("returns an empty string when there is nothing to embed", () => {
    expect(
      buildListingEmbeddingText({ title: null, descriptionClean: null, featureLines: [] }),
    ).toBe("");
  });
});
