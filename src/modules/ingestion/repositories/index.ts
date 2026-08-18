import { Prisma, PrismaClient } from "@prisma/client";

import { prisma } from "@/db/prisma";
import type {
  DuplicateScore,
  IngestionRunInput,
  IngestionRunSummary,
  NormalizedIngestionListing,
  PersistedIngestionResult,
  ValidatedIngestionDecision,
} from "@/modules/ingestion/types";
import type { ListingFeatureKey } from "@/modules/listings/constants";
import { mapSelectedMarketplaceFeature } from "@/scraping/selected-marketplace/attribute-map";

function toDate(value: string | null): Date | null {
  return value === null ? null : new Date(value);
}

function toDecimal(value: string | null): Prisma.Decimal | null {
  return value === null ? null : new Prisma.Decimal(value);
}

function getStringAttribute(
  attributes: Record<string, unknown>,
  key: string,
): string | null {
  const value = attributes[key];

  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function getNumericAttribute(
  attributes: Record<string, unknown>,
  key: string,
): Prisma.Decimal | null {
  const value = getStringAttribute(attributes, key);

  if (value === null) {
    return null;
  }

  const cleaned = value.replace(/[^\d,.-]/g, "").replace(",", ".");
  const parsed = Number(cleaned);

  return Number.isFinite(parsed) ? new Prisma.Decimal(parsed) : null;
}

function deriveFeatures(
  attributes: Record<string, unknown>,
): Array<{
  readonly key: ListingFeatureKey;
  readonly rawValue: string;
}> {
  const featureLists = attributes.featureLists;

  if (typeof featureLists !== "object" || featureLists === null) {
    return [];
  }

  const values = Object.values(featureLists).flatMap((entry) =>
    Array.isArray(entry) ? entry.filter((item): item is string => typeof item === "string") : [],
  );
  const seen = new Set<ListingFeatureKey>();

  return values.flatMap((value) => {
    const mapped = mapSelectedMarketplaceFeature(value);

    if (mapped === null || seen.has(mapped)) {
      return [];
    }

    seen.add(mapped);

    return [
      {
        key: mapped,
        rawValue: value,
      },
    ];
  });
}

export function createIngestionRepository(
  client: PrismaClient = prisma,
): {
  startImportRun: (input: IngestionRunInput) => Promise<{ readonly id: string; readonly startedAt: string }>;
  persistListing: (input: {
    readonly importRunId: string;
    readonly listing: NormalizedIngestionListing;
    readonly decision: ValidatedIngestionDecision;
    readonly publicationStatus: "PUBLISHED" | "REJECTED" | "NEEDS_REVIEW" | "DUPLICATE";
    readonly duplicateGroupId: string | null;
    readonly isPrimary: boolean;
    readonly duplicateScore: DuplicateScore | null;
    readonly descriptionSummary: string | null;
  }) => Promise<PersistedIngestionResult>;
  recordImportIssue: (input: {
    readonly importRunId: string;
    readonly sourceUrl: string;
    readonly stage: "DISCOVERY" | "FETCH" | "PARSE" | "NORMALIZE" | "VALIDATE" | "DEDUPLICATE" | "PERSIST";
    readonly result: "FAILED" | "REJECTED" | "DUPLICATE";
    readonly code: string;
    readonly message: string;
    readonly context: Record<string, unknown>;
  }) => Promise<void>;
  completeImportRun: (input: {
    readonly importRunId: string;
    readonly summary: IngestionRunSummary;
  }) => Promise<void>;
} {
  return {
    async startImportRun(input) {
      const startedAt = new Date();
      const importRun = await client.importRun.create({
        data: {
          source: input.source as "SELECTED_MARKETPLACE",
          startedAt,
          status: "RUNNING",
          configuration: input as unknown as Prisma.InputJsonValue,
        },
      });

      return {
        id: importRun.id,
        startedAt: startedAt.toISOString(),
      };
    },
    async persistListing(input) {
      const featureRows = deriveFeatures(input.listing.rawAttributes);
      const listingRecord = await client.listing.upsert({
        where: {
          source_sourceUrlCanonical: {
            source: input.listing.source as "SELECTED_MARKETPLACE",
            sourceUrlCanonical: input.listing.sourceUrlCanonical,
          },
        },
        create: {
          source: input.listing.source as "SELECTED_MARKETPLACE",
          sourceListingId: input.listing.sourceListingId,
          sourceUrl: input.listing.sourceUrl,
          sourceUrlCanonical: input.listing.sourceUrlCanonical,
          sourceContentHash: input.listing.sourceContentHash,
          propertyType: input.listing.propertyType,
          transactionType: input.listing.transactionType,
          publicationStatus: input.publicationStatus,
          rejectionReason: input.decision.rejectionReason,
          title: input.listing.title,
          descriptionRaw: input.listing.descriptionRaw,
          descriptionClean: input.listing.descriptionClean,
          descriptionSummary: input.descriptionSummary,
          priceAmount: toDecimal(input.listing.priceAmount),
          currency: input.listing.currency,
          administrativeFee: getNumericAttribute(input.listing.rawAttributes, "Czynsz"),
          depositAmount:
            getNumericAttribute(input.listing.rawAttributes, "Depozyt za wynajem") ??
            getNumericAttribute(input.listing.rawAttributes, "Kaucja"),
          areaM2: toDecimal(input.listing.areaM2),
          rooms: input.listing.rooms,
          city: input.listing.city,
          district: input.listing.district,
          street: input.listing.street,
          latitude: input.listing.latitude,
          longitude: input.listing.longitude,
          floor: input.listing.floor,
          floorCount: input.listing.floorCount,
          buildingYear: input.listing.buildingYear ?? null,
          marketType: getStringAttribute(input.listing.rawAttributes, "Rynek"),
          ownershipType: getStringAttribute(input.listing.rawAttributes, "Forma własności"),
          buildingType: getStringAttribute(input.listing.rawAttributes, "Typ budynku"),
          condition: getStringAttribute(input.listing.rawAttributes, "Stan nieruchomości"),
          sellerType: getStringAttribute(input.listing.rawAttributes, "sellerType"),
          availableFrom: toDate(input.listing.availableFrom),
          sourcePublishedAt: toDate(input.listing.sourcePublishedAt),
          sourceUpdatedAt: toDate(input.listing.sourceUpdatedAt),
          scrapedAt: toDate(input.listing.scrapedAt),
          contactName: input.listing.contactName,
          contactPhone: input.listing.contactPhone,
          rawAttributes: input.listing.rawAttributes as Prisma.InputJsonValue,
          rawPayload: input.listing.rawPayload as Prisma.InputJsonValue,
          qualityScore: input.duplicateScore?.score ?? null,
          duplicateGroupId: input.duplicateGroupId,
          isPrimary: input.isPrimary,
          photos: {
            create: input.listing.photos.map((photo) => ({
              url: photo.url,
              position: photo.position,
              isPrimary: photo.isPrimary,
            })),
          },
          features: {
            create: featureRows.map((feature) => ({
              key: feature.key,
              valueType: "BOOLEAN",
              booleanValue: true,
              rawValue: feature.rawValue,
            })),
          },
        },
        update: {
          sourceListingId: input.listing.sourceListingId,
          sourceUrl: input.listing.sourceUrl,
          sourceContentHash: input.listing.sourceContentHash,
          propertyType: input.listing.propertyType,
          transactionType: input.listing.transactionType,
          publicationStatus: input.publicationStatus,
          rejectionReason: input.decision.rejectionReason,
          title: input.listing.title,
          descriptionRaw: input.listing.descriptionRaw,
          descriptionClean: input.listing.descriptionClean,
          descriptionSummary: input.descriptionSummary,
          priceAmount: toDecimal(input.listing.priceAmount),
          currency: input.listing.currency,
          administrativeFee: getNumericAttribute(input.listing.rawAttributes, "Czynsz"),
          depositAmount:
            getNumericAttribute(input.listing.rawAttributes, "Depozyt za wynajem") ??
            getNumericAttribute(input.listing.rawAttributes, "Kaucja"),
          areaM2: toDecimal(input.listing.areaM2),
          rooms: input.listing.rooms,
          city: input.listing.city,
          district: input.listing.district,
          street: input.listing.street,
          latitude: input.listing.latitude,
          longitude: input.listing.longitude,
          floor: input.listing.floor,
          floorCount: input.listing.floorCount,
          buildingYear: input.listing.buildingYear ?? null,
          marketType: getStringAttribute(input.listing.rawAttributes, "Rynek"),
          ownershipType: getStringAttribute(input.listing.rawAttributes, "Forma własności"),
          buildingType: getStringAttribute(input.listing.rawAttributes, "Typ budynku"),
          condition: getStringAttribute(input.listing.rawAttributes, "Stan nieruchomości"),
          sellerType: getStringAttribute(input.listing.rawAttributes, "sellerType"),
          availableFrom: toDate(input.listing.availableFrom),
          sourcePublishedAt: toDate(input.listing.sourcePublishedAt),
          sourceUpdatedAt: toDate(input.listing.sourceUpdatedAt),
          scrapedAt: toDate(input.listing.scrapedAt),
          contactName: input.listing.contactName,
          contactPhone: input.listing.contactPhone,
          rawAttributes: input.listing.rawAttributes as Prisma.InputJsonValue,
          rawPayload: input.listing.rawPayload as Prisma.InputJsonValue,
          qualityScore: input.duplicateScore?.score ?? null,
          duplicateGroupId: input.duplicateGroupId,
          isPrimary: input.isPrimary,
          photos: {
            deleteMany: {},
            create: input.listing.photos.map((photo) => ({
              url: photo.url,
              position: photo.position,
              isPrimary: photo.isPrimary,
            })),
          },
          features: {
            deleteMany: {},
            create: featureRows.map((feature) => ({
              key: feature.key,
              valueType: "BOOLEAN",
              booleanValue: true,
              rawValue: feature.rawValue,
            })),
          },
        },
      });

      return {
        sourceUrl: input.listing.sourceUrl,
        publicationStatus: input.publicationStatus,
        duplicateOf: input.isPrimary ? null : input.duplicateGroupId,
        persisted: listingRecord.id.length > 0,
      };
    },
    async recordImportIssue(input) {
      await client.ingestionIssue.create({
        data: {
          importRunId: input.importRunId,
          sourceUrl: input.sourceUrl,
          stage: input.stage,
          result: input.result,
          code: input.code,
          message: input.message,
          context: input.context as Prisma.InputJsonValue,
        },
      });
    },
    async completeImportRun(input) {
      await client.importRun.update({
        where: {
          id: input.importRunId,
        },
        data: {
          finishedAt: new Date(input.summary.finishedAt),
          status: input.summary.status,
          candidatesDiscovered: input.summary.candidatesDiscovered,
          pagesFetched: input.summary.pagesFetched,
          parsedCount: input.summary.parsedCount,
          normalizedCount: input.summary.normalizedCount,
          publishedCount: input.summary.publishedCount,
          rejectedCount: input.summary.rejectedCount,
          needsReviewCount: input.summary.needsReviewCount,
          duplicateCount: input.summary.duplicateCount,
          failedCount: input.summary.failedCount,
        },
      });
    },
  };
}
