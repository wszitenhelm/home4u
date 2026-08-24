import { Prisma } from "@prisma/client";
import { z } from "zod";

import { prisma } from "@/db/prisma";
import {
  EMBEDDING_MODEL,
  buildListingEmbeddingText,
  generateEmbedding,
  isEmbeddingSearchEnabled,
} from "@/modules/listings/ai/embeddings";
import { formatFeatureValue } from "@/modules/listings/formatters";
import { mapListingFeature } from "@/modules/listings/mappers";

const limitSchema = z.coerce.number().int().positive().max(500);
const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 10_500;

function wait(durationMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, durationMs));
}

function parseLimit(args: readonly string[]): number | undefined {
  const rawLimit = args.find((argument) => argument.startsWith("--limit="))?.slice(8);

  return rawLimit === undefined ? undefined : limitSchema.parse(rawLimit);
}

async function main(): Promise<void> {
  if (!isEmbeddingSearchEnabled()) {
    throw new Error("GEMINI_API_KEY is required to backfill listing embeddings.");
  }

  const args = process.argv.slice(2);
  const limit = parseLimit(args);
  // Idempotent by default: only listings missing an embedding are picked up,
  // so re-running (e.g. a periodic scheduled run) is always safe. --force
  // regenerates every published listing, e.g. after switching models.
  const force = args.includes("--force");

  const run = await prisma.embeddingBackfillRun.create({
    data: { startedAt: new Date(), status: "RUNNING" },
  });

  let updated = 0;
  let skipped = 0;
  let failed = 0;
  let crashed = false;

  try {
    const listings = await prisma.listing.findMany({
      where: {
        publicationStatus: "PUBLISHED",
        isPrimary: true,
        ...(force ? {} : { embedding: { equals: Prisma.DbNull } }),
      },
      orderBy: { id: "asc" },
      take: limit,
      select: {
        id: true,
        title: true,
        descriptionClean: true,
        condition: true,
        features: {
          select: {
            key: true,
            valueType: true,
            booleanValue: true,
            numberValue: true,
            textValue: true,
            rawValue: true,
          },
        },
      },
    });

    for (let offset = 0; offset < listings.length; offset += BATCH_SIZE) {
      const batch = listings.slice(offset, offset + BATCH_SIZE);

      await Promise.all(
        batch.map(async (listing) => {
          const featureLines = listing.features.map((feature) =>
            formatFeatureValue(mapListingFeature(feature)),
          );
          const text = buildListingEmbeddingText({
            title: listing.title,
            descriptionClean: listing.descriptionClean,
            condition: listing.condition,
            featureLines,
          });

          if (text.trim().length === 0) {
            skipped += 1;
            console.error("Skipping listing with no embeddable text", { listingId: listing.id });

            return;
          }

          const embedding = await generateEmbedding(text, "RETRIEVAL_DOCUMENT");

          if (embedding === null) {
            failed += 1;
            console.error("Embedding generation failed for listing", { listingId: listing.id });

            return;
          }

          await prisma.listing.update({
            where: { id: listing.id },
            data: {
              embedding: embedding as Prisma.InputJsonValue,
              embeddingModel: EMBEDDING_MODEL,
              embeddingGeneratedAt: new Date(),
            },
          });
          updated += 1;
        }),
      );

      // Persisted after every batch (not just at the end) so a run record
      // reflects real progress even if the process is killed outright and
      // never reaches the try/finally below.
      await prisma.embeddingBackfillRun.update({
        where: { id: run.id },
        data: {
          listingsProcessed: updated + skipped + failed,
          embeddingsGenerated: updated,
          failedCount: failed,
        },
      });

      console.info(
        JSON.stringify({
          type: "embeddings-backfill-progress",
          processed: Math.min(offset + batch.length, listings.length),
          total: listings.length,
          updated,
          skipped,
          failed,
        }),
      );

      if (offset + batch.length < listings.length) {
        await wait(BATCH_DELAY_MS);
      }
    }

    console.info(
      JSON.stringify(
        {
          type: "embeddings-backfill",
          selected: listings.length,
          updated,
          skipped,
          failed,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    crashed = true;
    throw error;
  } finally {
    await prisma.embeddingBackfillRun.update({
      where: { id: run.id },
      data: {
        finishedAt: new Date(),
        status: crashed ? "FAILED" : failed > 0 ? "COMPLETED_WITH_ERRORS" : "COMPLETED",
        listingsProcessed: updated + skipped + failed,
        embeddingsGenerated: updated,
        failedCount: failed,
      },
    });
  }
}

main()
  .catch((error: unknown) => {
    console.error("Embeddings backfill failed.", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
