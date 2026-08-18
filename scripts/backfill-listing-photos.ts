import { load } from "cheerio";

import { prisma } from "@/db/prisma";
import { selectedMarketplaceAdapter } from "@/scraping/selected-marketplace/adapter";

const concurrency = 4;
const requestTimeoutMs = 20_000;

interface BackfillResult {
  readonly status: "UPDATED" | "UNCHANGED" | "FAILED";
  readonly photoCount: number;
}

async function fetchListingHtml(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      accept: "text/html,application/xhtml+xml",
      "accept-language": "pl-PL,pl;q=0.9",
      "user-agent": "Home4uMvpImporter/1.0 (+local educational project)",
    },
    signal: AbortSignal.timeout(requestTimeoutMs),
  });

  if (!response.ok) {
    throw new Error(`Source returned HTTP ${response.status}.`);
  }

  return response.text();
}

async function backfillListing(input: {
  readonly id: string;
  readonly sourceUrl: string;
  readonly currentPhotoCount: number;
}): Promise<BackfillResult> {
  const html = await fetchListingHtml(input.sourceUrl);
  const parsed = selectedMarketplaceAdapter.parseListing({
    url: input.sourceUrl,
    html,
    $: load(html),
    fetchedAt: new Date().toISOString(),
  });

  if (parsed.photos.length === 0) {
    throw new Error("No listing photos found; existing photos were preserved.");
  }

  if (parsed.photos.length === input.currentPhotoCount) {
    return { status: "UNCHANGED", photoCount: parsed.photos.length };
  }

  await prisma.listing.update({
    where: { id: input.id },
    data: {
      photos: {
        deleteMany: {},
        create: parsed.photos.map((url, position) => ({
          url,
          position,
          isPrimary: position === 0,
        })),
      },
    },
  });

  return { status: "UPDATED", photoCount: parsed.photos.length };
}

async function main(): Promise<void> {
  const listings = await prisma.listing.findMany({
    where: {
      source: "SELECTED_MARKETPLACE",
      publicationStatus: "PUBLISHED",
      isPrimary: true,
    },
    select: {
      id: true,
      sourceUrl: true,
      _count: { select: { photos: true } },
    },
    orderBy: { id: "asc" },
  });

  let cursor = 0;
  let updated = 0;
  let unchanged = 0;
  let failed = 0;

  async function worker(): Promise<void> {
    while (cursor < listings.length) {
      const index = cursor;
      cursor += 1;
      const listing = listings[index];

      if (listing === undefined) {
        return;
      }

      try {
        const result = await backfillListing({
          id: listing.id,
          sourceUrl: listing.sourceUrl,
          currentPhotoCount: listing._count.photos,
        });

        if (result.status === "UPDATED") {
          updated += 1;
        } else {
          unchanged += 1;
        }

        console.log(
          `[${index + 1}/${listings.length}] ${result.status} ${result.photoCount} photos ${listing.sourceUrl}`,
        );
      } catch (error) {
        failed += 1;
        console.error(
          `[${index + 1}/${listings.length}] FAILED ${listing.sourceUrl}`,
          error instanceof Error ? error.message : error,
        );
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  console.log(
    `Photo backfill complete: ${updated} updated, ${unchanged} unchanged, ${failed} failed.`,
  );
}

main()
  .catch((error: unknown) => {
    console.error("Photo backfill failed.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
