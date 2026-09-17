import { z } from "zod";

import { env } from "@/shared/env";
import { logAiCall } from "@/shared/logging";

// Fixed dimensionality (rather than the model's larger native size) keeps
// stored vectors small and comparisons cheap - plenty for ~100 listings
// compared brute-force, no vector database needed at this scale.
export const EMBEDDING_MODEL = "gemini-embedding-001";
export const EMBEDDING_DIMENSIONS = 768;

const REQUEST_TIMEOUT_MS = 12_000;

// Gemini's embedding API is asymmetric: a listing's own text is indexed as
// a "document", a user's search phrase is embedded as a "query". Using the
// matching task type for each measurably improves retrieval quality.
export type EmbeddingTaskType = "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY";

const embedContentResponseSchema = z.object({
  embedding: z.object({
    values: z.array(z.number()).length(EMBEDDING_DIMENSIONS),
  }),
});

export function isEmbeddingSearchEnabled(): boolean {
  return env.GEMINI_API_KEY !== undefined;
}

/**
 * Returns null (never throws) whenever embeddings aren't configured or the
 * call fails, so callers can fall back to plain-text search deterministically
 * - same discipline as summarizeListingDescription/parseNaturalListingSearch.
 */
export async function generateEmbedding(
  text: string,
  taskType: EmbeddingTaskType,
): Promise<number[] | null> {
  if (env.GEMINI_API_KEY === undefined) {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const startedAt = Date.now();
  const log = async (success: boolean, detail?: string): Promise<void> => {
    await logAiCall({
      event: "generate_embedding",
      durationMs: Date.now() - startedAt,
      success,
      fallbackTriggered: !success,
      model: EMBEDDING_MODEL,
      detail,
    });
  };

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": env.GEMINI_API_KEY,
        },
        body: JSON.stringify({
          model: `models/${EMBEDDING_MODEL}`,
          content: { parts: [{ text }] },
          taskType,
          outputDimensionality: EMBEDDING_DIMENSIONS,
        }),
        cache: "no-store",
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      await log(false, `HTTP ${response.status}`);

      return null;
    }

    const payload: unknown = await response.json();
    const parsed = embedContentResponseSchema.safeParse(payload);

    if (!parsed.success) {
      await log(false, "response failed validation");

      return null;
    }

    await log(true);

    return parsed.data.embedding.values;
  } catch (error) {
    await log(false, error instanceof Error ? error.message : String(error));

    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export function cosineSimilarity(a: readonly number[], b: readonly number[]): number {
  if (a.length !== b.length || a.length === 0) {
    return 0;
  }

  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let index = 0; index < a.length; index += 1) {
    const valueA = a[index];
    const valueB = b[index];

    if (valueA === undefined || valueB === undefined) {
      continue;
    }

    dotProduct += valueA * valueB;
    magnitudeA += valueA * valueA;
    magnitudeB += valueB * valueB;
  }

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }

  return dotProduct / (Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB));
}

export function buildListingEmbeddingText(input: {
  readonly title: string | null;
  readonly descriptionClean: string | null;
  readonly featureLines: readonly string[];
  // Style/renovation state (e.g. "Wysoki standard", "Do remontu"). Worth its
  // own explicit sentence rather than relying on descriptionClean alone: a
  // query like "nowoczesne mieszkanie" (modern flat) needs a direct signal
  // to rank a dated flat below a renovated one - the surrounding listing
  // boilerplate ("Do wynajęcia mieszkanie...") is otherwise near-identical
  // across the whole corpus and dominates the similarity score.
  readonly condition: string | null;
}): string {
  const conditionLine =
    input.condition !== null && input.condition.trim().length > 0
      ? `Stan: ${input.condition}.`
      : null;
  const parts = [input.title, input.descriptionClean, conditionLine, ...input.featureLines].filter(
    (part): part is string => part !== null && part.trim().length > 0,
  );

  return parts.join(". ");
}
