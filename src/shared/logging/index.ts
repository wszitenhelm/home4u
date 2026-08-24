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

export function logAiCall(context: AiCallLogContext): void {
  if (context.success) {
    console.info("ai-call", context);
  } else {
    console.error("ai-call", context);
  }
}
