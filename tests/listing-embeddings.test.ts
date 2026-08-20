import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildListingEmbeddingText,
  cosineSimilarity,
} from "@/modules/listings/ai/embeddings";

// These tests must never hit the real Gemini API, even though the local
// .env used by the test setup may contain a real key: @/shared/env is
// mocked per-test so behavior is independent of whatever is actually in the
// developer's local .env, and global.fetch is mocked/spied so no network
// call can occur even if that mock were wrong. Same convention as
// tests/ingestion-ai-summary.test.ts.

// resetModules runs both before and after: the module under test was
// already loaded once by buildListingEmbeddingText/cosineSimilarity's
// static import above, so the very first test here also needs a fresh
// module graph for its env mock to take effect, not just the tests after.
beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
  vi.unstubAllGlobals();
});

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

describe("generateEmbedding", () => {
  const vector = Array.from({ length: 768 }, () => 0.01);

  it("returns null and never calls fetch when no API key is configured", async () => {
    vi.doMock("@/shared/env", () => ({ env: { GEMINI_API_KEY: undefined } }));
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const { generateEmbedding } = await import("@/modules/listings/ai/embeddings");

    await expect(generateEmbedding("mieszkanie", "RETRIEVAL_QUERY")).resolves.toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("logs one structured success event and returns the vector on a well-formed response", async () => {
    vi.doMock("@/shared/env", () => ({ env: { GEMINI_API_KEY: "test-key" } }));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ embedding: { values: vector } }) }),
    );
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const { generateEmbedding } = await import("@/modules/listings/ai/embeddings");

    await expect(generateEmbedding("mieszkanie", "RETRIEVAL_QUERY")).resolves.toEqual(vector);
    expect(errorSpy).not.toHaveBeenCalled();
    expect(infoSpy).toHaveBeenCalledTimes(1);
    expect(infoSpy).toHaveBeenCalledWith(
      "ai-call",
      expect.objectContaining({
        event: "generate_embedding",
        success: true,
        fallbackTriggered: false,
        model: "gemini-embedding-001",
        durationMs: expect.any(Number),
      }),
    );
  });

  it("logs one structured failure event and returns null when the HTTP response is not ok", async () => {
    vi.doMock("@/shared/env", () => ({ env: { GEMINI_API_KEY: "test-key" } }));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const { generateEmbedding } = await import("@/modules/listings/ai/embeddings");

    await expect(generateEmbedding("mieszkanie", "RETRIEVAL_QUERY")).resolves.toBeNull();
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(
      "ai-call",
      expect.objectContaining({
        event: "generate_embedding",
        success: false,
        fallbackTriggered: true,
        model: "gemini-embedding-001",
        detail: "HTTP 500",
      }),
    );
  });

  it("logs one structured failure event and returns null when fetch rejects", async () => {
    vi.doMock("@/shared/env", () => ({ env: { GEMINI_API_KEY: "test-key" } }));
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network unreachable")));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const { generateEmbedding } = await import("@/modules/listings/ai/embeddings");

    await expect(generateEmbedding("mieszkanie", "RETRIEVAL_QUERY")).resolves.toBeNull();
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(
      "ai-call",
      expect.objectContaining({
        success: false,
        fallbackTriggered: true,
        detail: "network unreachable",
      }),
    );
  });
});
