import type { Prisma, PrismaClient } from "@prisma/client";

import { prisma } from "@/db/prisma";
import type { ListingFeatureKey } from "@/modules/listings/constants";
import type {
  ListingRecord,
  ListingRepository,
  ListingRepositoryListResult,
  ListingSearchInput,
} from "@/modules/listings/types";

type ListingDelegate = PrismaClient["listing"];

const featureSearchTerms: Record<ListingFeatureKey, readonly string[]> = {
  BALCONY: ["balkon"],
  ELEVATOR: ["winda"],
  PARKING: ["parking", "miejsce postojowe"],
  GARAGE: ["garaż", "garaz"],
  TERRACE: ["taras"],
  GARDEN: ["ogród", "ogrod"],
  FURNISHED: ["umeblowan"],
  PET_FRIENDLY: ["zwierzę", "zwierzet"],
  AIR_CONDITIONING: ["klimatyzac"],
  STORAGE_ROOM: ["komórka lokatorska", "komorka lokatorska"],
  SECURITY: ["ochrona"],
  GATED_PROPERTY: ["osiedle zamknięte", "osiedle zamkniete"],
};

const publicListingSelect = {
  id: true,
  source: true,
  sourceUrl: true,
  transactionType: true,
  title: true,
  descriptionClean: true,
  descriptionSummary: true,
  priceAmount: true,
  currency: true,
  administrativeFee: true,
  depositAmount: true,
  utilitiesDescription: true,
  areaM2: true,
  rooms: true,
  city: true,
  district: true,
  street: true,
  latitude: true,
  longitude: true,
  floor: true,
  floorCount: true,
  buildingYear: true,
  marketType: true,
  ownershipType: true,
  buildingType: true,
  condition: true,
  sellerType: true,
  availableFrom: true,
  sourcePublishedAt: true,
  sourceUpdatedAt: true,
  contactName: true,
  contactPhone: true,
  createdAt: true,
  photos: {
    orderBy: {
      position: "asc",
    },
    select: {
      url: true,
      position: true,
      isPrimary: true,
    },
  },
  features: {
    orderBy: {
      key: "asc",
    },
    select: {
      key: true,
      valueType: true,
      booleanValue: true,
      numberValue: true,
      textValue: true,
      rawValue: true,
    },
  },
} satisfies Prisma.ListingSelect;

function buildPublicListingWhere(input: ListingSearchInput): Prisma.ListingWhereInput {
  const where: Prisma.ListingWhereInput = {
    publicationStatus: "PUBLISHED",
    isPrimary: true,
  };
  const andConditions: Prisma.ListingWhereInput[] = [];

  if (input.q !== undefined) {
    andConditions.push({
      OR: [
        { title: { contains: input.q } },
        { descriptionClean: { contains: input.q } },
        { city: { contains: input.q } },
        { district: { contains: input.q } },
        { street: { contains: input.q } },
      ],
    });
  }

  if (input.transactionType !== undefined) {
    where.transactionType = input.transactionType;
  }

  if (input.city !== undefined) {
    where.city = { in: input.city };
  }

  if (input.district !== undefined) {
    where.district = { equals: input.district };
  }

  if (input.rooms !== undefined) {
    where.rooms = input.rooms;
  }

  if (input.minPrice !== undefined || input.maxPrice !== undefined) {
    where.priceAmount = {
      gte: input.minPrice,
      lte: input.maxPrice,
    };
  }

  if (input.minArea !== undefined || input.maxArea !== undefined) {
    where.areaM2 = {
      gte: input.minArea,
      lte: input.maxArea,
    };
  }

  if (input.minFloor !== undefined || input.maxFloor !== undefined) {
    where.floor = {
      gte: input.minFloor,
      lte: input.maxFloor,
    };
  }

  if (input.features !== undefined) {
    for (const feature of input.features) {
      const textConditions: Prisma.ListingWhereInput[] = featureSearchTerms[feature].flatMap(
        (term) => [
          { title: { contains: term } },
          { descriptionClean: { contains: term } },
        ],
      );

      andConditions.push({
        OR: [
          {
            features: {
              some: {
                key: feature,
                booleanValue: true,
              },
            },
          },
          ...textConditions,
        ],
      });
    }
  }

  if (andConditions.length > 0) {
    where.AND = andConditions;
  }

  return where;
}

function buildOrderBy(
  sort: ListingSearchInput["sort"],
): Prisma.ListingOrderByWithRelationInput[] {
  switch (sort) {
    case "price_asc":
      return [{ priceAmount: "asc" }, { id: "asc" }];
    case "price_desc":
      return [{ priceAmount: "desc" }, { id: "asc" }];
    case "area_asc":
      return [{ areaM2: "asc" }, { id: "asc" }];
    case "area_desc":
      return [{ areaM2: "desc" }, { id: "asc" }];
    case "newest":
    default:
      return [{ sourcePublishedAt: "desc" }, { createdAt: "desc" }, { id: "asc" }];
  }
}

export function createListingRepository(delegate: ListingDelegate = prisma.listing): ListingRepository {
  return {
    async findPublicListings(input: ListingSearchInput): Promise<ListingRepositoryListResult> {
      const where = buildPublicListingWhere(input);
      const skip = (input.page - 1) * input.pageSize;
      const [total, items] = await Promise.all([
        delegate.count({ where }),
        delegate.findMany({
          where,
          orderBy: buildOrderBy(input.sort),
          skip,
          take: input.pageSize,
          select: publicListingSelect,
        }),
      ]);

      return {
        total,
        items: items as ListingRecord[],
      };
    },
    async findPublicListingById(id: string): Promise<ListingRecord | null> {
      const listing = await delegate.findFirst({
        where: {
          id,
          publicationStatus: "PUBLISHED",
          isPrimary: true,
        },
        select: publicListingSelect,
      });

      return (listing as ListingRecord | null) ?? null;
    },
  };
}

export const listingRepository = createListingRepository();

export { buildOrderBy, buildPublicListingWhere, publicListingSelect };
