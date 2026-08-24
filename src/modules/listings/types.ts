import type { Prisma } from "@prisma/client";

import type {
  ListingFeature,
  ListingPhoto,
  ListingSearchInput,
  PaginatedListingResponse,
  PublicListingDetail,
  PublicListingListItem,
} from "@/modules/listings/schemas";

export interface ListingRepositoryListResult {
  readonly total: number;
  readonly items: ListingRecord[];
}

export interface ListingEmbeddingRecord {
  readonly id: string;
  readonly embedding: number[];
}

export interface ListingRepository {
  findPublicListings(input: ListingSearchInput): Promise<ListingRepositoryListResult>;
  findPublicListingById(id: string): Promise<ListingRecord | null>;
  // Filtered by the same structured criteria (transactionType, city, price,
  // etc.) as findPublicListings, so ranking by similarity happens within the
  // listings the user actually asked for rather than the whole catalog.
  findPublishedListingEmbeddings(input: ListingSearchInput): Promise<ListingEmbeddingRecord[]>;
  findPublicListingsByIds(ids: readonly string[]): Promise<ListingRecord[]>;
}

export type ListingIndexResult = PaginatedListingResponse;

export type ListingRecord = Prisma.ListingGetPayload<{
  select: {
    id: true;
    source: true;
    sourceUrl: true;
    transactionType: true;
    title: true;
    descriptionClean: true;
    descriptionSummary: true;
    priceAmount: true;
    currency: true;
    administrativeFee: true;
    depositAmount: true;
    utilitiesDescription: true;
    areaM2: true;
    rooms: true;
    city: true;
    district: true;
    street: true;
    latitude: true;
    longitude: true;
    floor: true;
    floorCount: true;
    buildingYear: true;
    marketType: true;
    ownershipType: true;
    buildingType: true;
    condition: true;
    sellerType: true;
    availableFrom: true;
    sourcePublishedAt: true;
    sourceUpdatedAt: true;
    contactName: true;
    contactPhone: true;
    createdAt: true;
    photos: {
      orderBy: {
        position: "asc";
      };
      select: {
        url: true;
        position: true;
        isPrimary: true;
      };
    };
    features: {
      orderBy: {
        key: "asc";
      };
      select: {
        key: true;
        valueType: true;
        booleanValue: true;
        numberValue: true;
        textValue: true;
        rawValue: true;
      };
    };
  };
}>;

export type {
  ListingFeature,
  ListingPhoto,
  ListingSearchInput,
  PaginatedListingResponse,
  PublicListingDetail,
  PublicListingListItem,
};
