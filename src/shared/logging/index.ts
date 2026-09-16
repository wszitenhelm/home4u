import { prisma } from "@/db/prisma";

export function logInfo(message: string, context?: Record<string, unknown>): void {
  console.info(message, context);
}

/**
 * One call per Gemini call attempt, shared by every AI call site
 * (embeddings.ts, parse-natural-search.ts) so the shape stays identical
 * everywhere instead of each call site inventing its own. success: false
 * always implies the caller fell back to its deterministic path - same
 * discipline as the calls themselves (never throw, always fall back).
 */
export interface AiCallLogContext {
  readonly event: string;
  readonly durationMs: number;
  readonly success: boolean;
  readonly fallbackTriggered: boolean;
  readonly model: string;
  readonly detail?: string;
}

/**
 * Persists the same event to AiCallLog (for the Grafana reliability/latency
 * dashboards) in addition to the console output below. Awaited inline rather
 * than fired-and-forgotten: this is called from both live search requests
 * and the standalone backfill script, and an un-awaited write on Vercel can
 * be killed before it completes once the response is sent. A single insert
 * adds a few ms on top of a Gemini call that already takes hundreds of ms to
 * seconds, so the trade-off is negligible. A logging failure must never
 * break the actual search, so this never throws - it's swallowed and
 * reported the same way a failed Gemini call itself would be.
 */
async function persistAiCallLog(context: AiCallLogContext): Promise<void> {
  try {
    await prisma.aiCallLog.create({ data: context });
  } catch (error) {
    console.error(
      "Failed to persist AI call log",
      error instanceof Error ? error.message : error,
    );
  }
}

export async function logAiCall(context: AiCallLogContext): Promise<void> {
  if (context.success) {
    console.info("ai-call", context);
  } else {
    console.error("ai-call", context);
  }

  await persistAiCallLog(context);
}
