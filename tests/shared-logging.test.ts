import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// logAiCall's DB write must never depend on, or be observable through, the
// real database in tests - @/db/prisma is mocked per test, same convention
// as the AI call-site tests that exercise this function indirectly.
beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("logAiCall", () => {
  it("persists the event to AiCallLog in addition to logging it", async () => {
    const create = vi.fn().mockResolvedValue({});
    vi.doMock("@/db/prisma", () => ({ prisma: { aiCallLog: { create } } }));
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);

    const { logAiCall } = await import("@/shared/logging");

    await logAiCall({
      event: "generate_embedding",
      durationMs: 42,
      success: true,
      fallbackTriggered: false,
      model: "gemini-embedding-001",
    });

    expect(infoSpy).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith({
      data: {
        event: "generate_embedding",
        durationMs: 42,
        success: true,
        fallbackTriggered: false,
        model: "gemini-embedding-001",
      },
    });
  });

  it("never throws when the persistence write fails", async () => {
    vi.doMock("@/db/prisma", () => ({
      prisma: { aiCallLog: { create: vi.fn().mockRejectedValue(new Error("connection refused")) } },
    }));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const { logAiCall } = await import("@/shared/logging");

    await expect(
      logAiCall({
        event: "parse_natural_search",
        durationMs: 10,
        success: false,
        fallbackTriggered: true,
        model: "gemini-3.1-flash-lite",
        detail: "HTTP 500",
      }),
    ).resolves.toBeUndefined();
  });
});
