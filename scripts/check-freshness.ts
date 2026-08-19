import { load } from "cheerio";
import { z } from "zod";

import { prisma } from "@/db/prisma";
import { selectedMarketplaceAdapter } from "@/scraping/selected-marketplace/adapter";
import { env } from "@/shared/env";

const limitSchema = z.coerce.number().int().positive().max(5_000);
const BATCH_SIZE = 3;
const BATCH_DELAY_MS = 3_000;

// The listing's own "no longer available" message is the primary signal:
// Morizon renders this on a 200 response for a removed offer, so status
// codes alone would miss it.
const REMOVED_LISTING_MARKER = "nie jest już dostępne";

type ListingCheckOutcome =
  | { readonly status: "EXPIRED" }
  // photos is null when the page parsed but photos couldn't be extracted -
  // that shouldn't fail the whole freshness check, just skip the photo
  // comparison for this listing.
  | { readonly status: "LIVE"; readonly photos: readonly string[] | null };

function wait(durationMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, durationMs));
}

function parseLimit(args: readonly string[]): number | undefined {
  const rawLimit = args.find((argument) => argument.startsWith("--limit="))?.slice(8);

  return rawLimit === undefined ? undefined : limitSchema.parse(rawLimit);
}

function hasSameGallery(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((url, index) => url === b[index]);
}

async function checkListing(sourceUrl: string): Promise<ListingCheckOutcome> {
  const response = await fetch(sourceUrl, {
    headers: {
      accept: "text/html,application/xhtml+xml",
      "user-agent": env.INGESTION_USER_AGENT,
    },
    redirect: "follow",
    signal: AbortSignal.timeout(env.INGESTION_HTTP_TIMEOUT_MS),
  });

  const html = await response.text().catch(() => "");

  if (html.toLowerCase().includes(REMOVED_LISTING_MARKER)) {
    return { status: "EXPIRED" };
  }

  // Fallback signals for responses that don't carry the removal text: a hard
  // 404, or a redirect that no longer lands on the same listing page.
  if (response.status === 404) {
    return { status: "EXPIRED" };
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const originalListingId = selectedMarketplaceAdapter.extractSourceListingId(sourceUrl);
  const finalListingId = selectedMarketplaceAdapter.extractSourceListingId(response.url);

  if (originalListingId !== null && finalListingId !== originalListingId) {
    return { status: "EXPIRED" };
  }

  // Still live: reuse the page we already fetched to also check the photo
  // gallery, instead of a second request just for photos.
  try {
    const parsed = selectedMarketplaceAdapter.parseListing({
      url: response.url,
      html,
      $: load(html),
      fetchedAt: new Date().toISOString(),
    });

    return { status: "LIVE", photos: parsed.photos.length > 0 ? parsed.photos : null };
  } catch {
    return { status: "LIVE", photos: null };
  }
}

async function main(): Promise<void> {
  const limit = parseLimit(process.argv.slice(2));
  const listings = await prisma.listing.findMany({
    where: {
      source: "SELECTED_MARKETPLACE",
      publicationStatus: "PUBLISHED",
      isPrimary: true,
    },
    orderBy: { id: "asc" },
    take: limit,
    select: {
      id: true,
      sourceUrl: true,
      photos: { select: { url: true }, orderBy: { position: "asc" } },
    },
  });

  let expired = 0;
  let live = 0;
  let photosUpdated = 0;
  let failed = 0;

  for (let offset = 0; offset < listings.length; offset += BATCH_SIZE) {
    const batch = listings.slice(offset, offset + BATCH_SIZE);

    await Promise.all(
      batch.map(async (listing) => {
        try {
          const outcome = await checkListing(listing.sourceUrl);

          if (outcome.status === "EXPIRED") {
            // Status change only, matching the rest of the app: nothing is
            // ever hard-deleted here.
            await prisma.listing.update({
              where: { id: listing.id },
              data: { publicationStatus: "EXPIRED" },
            });
            expired += 1;
            return;
          }

          live += 1;

          if (outcome.photos === null) {
            return;
          }

          const currentPhotoUrls = listing.photos.map((photo) => photo.url);

          if (hasSameGallery(outcome.photos, currentPhotoUrls)) {
            return;
          }

          // A seller can swap photos on Morizon's CDN without changing the
          // listing itself, which leaves stale, now-404ing URLs behind if
          // nothing re-checks them.
          await prisma.listing.update({
            where: { id: listing.id },
            data: {
              photos: {
                deleteMany: {},
                create: outcome.photos.map((url, position) => ({
                  url,
                  position,
                  isPrimary: position === 0,
                })),
              },
            },
          });
          photosUpdated += 1;
        } catch (error) {
          // A transient fetch failure doesn't confirm removal, so the
          // listing is left untouched and will be re-checked on the next
          // scheduled run rather than retried within this one.
          failed += 1;
          console.error("Freshness check failed for listing", {
            listingId: listing.id,
            sourceUrl: listing.sourceUrl,
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }),
    );

    console.info(
      JSON.stringify({
        type: "freshness-check-progress",
        processed: Math.min(offset + batch.length, listings.length),
        total: listings.length,
        expired,
        live,
        photosUpdated,
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
        type: "freshness-check",
        checked: listings.length,
        expired,
        live,
        photosUpdated,
        failed,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error: unknown) => {
    console.error("Freshness check failed.", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
