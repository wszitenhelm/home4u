import type { Decimal } from "@prisma/client/runtime/library";

import { parseListingAiSummary } from "@/modules/listings/ai-summary";
import {
  deriveListingHighlights,
  formatListingDisplayTitle,
} from "@/modules/listings/formatters";
import type {
  ListingFeature,
  ListingPhoto,
  PublicListingDetail,
  PublicListingListItem,
} from "@/modules/listings/types";
import type { ListingRecord } from "@/modules/listings/types";

function decimalToString(value: Decimal | null): string | null {
  return value?.toFixed(2) ?? null;
}

function requireValue<T>(value: T | null, field: string): T {
  if (value === null) {
    throw new Error(`Public listing is missing required field: ${field}`);
  }

  return value;
}

function toIsoString(value: Date | null): string | null {
  return value?.toISOString() ?? null;
}

function mapListingPhoto(photo: ListingRecord["photos"][number]): ListingPhoto {
  return {
    url: photo.url,
    position: photo.position,
    isPrimary: photo.isPrimary,
  };
}

export function mapListingFeature(feature: ListingRecord["features"][number]): ListingFeature {
  return {
    key: feature.key,
    valueType: feature.valueType,
    booleanValue: feature.booleanValue,
    numberValue: decimalToString(feature.numberValue),
    textValue: feature.textValue,
    rawValue: feature.rawValue,
  };
}

function getLeadPhoto(photos: ListingRecord["photos"]): ListingPhoto | null {
  const primary = photos.find((photo) => photo.isPrimary) ?? photos[0];

  return primary === undefined ? null : mapListingPhoto(primary);
}

function getPublishedAt(listing: ListingRecord): string | null {
  return toIsoString(listing.sourcePublishedAt ?? listing.createdAt);
}

function calculatePricePerSquareMetre(listing: ListingRecord): string | null {
  if (
    listing.transactionType !== "SALE" ||
    listing.priceAmount === null ||
    listing.areaM2 === null ||
    listing.areaM2.lte(0)
  ) {
    return null;
  }

  return listing.priceAmount.div(listing.areaM2).toFixed(2);
}

export function mapListingRecordToListItem(listing: ListingRecord): PublicListingListItem {
  const title = requireValue(listing.title, "title");
  const areaM2 = requireValue(decimalToString(listing.areaM2), "areaM2");
  const city = requireValue(listing.city, "city");
  const features = listing.features.map(mapListingFeature);

  return {
    id: listing.id,
    title,
    displayTitle: formatListingDisplayTitle({
      areaM2,
      city,
      district: listing.district,
      rooms: listing.rooms,
    }),
    highlights: deriveListingHighlights({
      sourceTitle: title,
      buildingType: listing.buildingType,
      features,
    }),
    transactionType: requireValue(listing.transactionType, "transactionType"),
    source: listing.source,
    sourceUrl: listing.sourceUrl,
    priceAmount: requireValue(decimalToString(listing.priceAmount), "priceAmount"),
    currency: requireValue(listing.currency, "currency"),
    administrativeFee: decimalToString(listing.administrativeFee),
    pricePerSquareMetre: calculatePricePerSquareMetre(listing),
    areaM2,
    rooms: listing.rooms,
    city,
    district: listing.district,
    street: listing.street,
    floor: listing.floor,
    publishedAt: getPublishedAt(listing),
    photo: getLeadPhoto(listing.photos),
  };
}

export function mapListingRecordToDetail(listing: ListingRecord): PublicListingDetail {
  return {
    ...mapListingRecordToListItem(listing),
    description: listing.descriptionClean,
    aiSummary: parseListingAiSummary(listing.descriptionSummary),
    latitude: listing.latitude?.toNumber() ?? null,
    longitude: listing.longitude?.toNumber() ?? null,
    depositAmount: decimalToString(listing.depositAmount),
    utilitiesDescription: listing.utilitiesDescription,
    floorCount: listing.floorCount,
    buildingYear: listing.buildingYear,
    marketType: listing.marketType,
    ownershipType: listing.ownershipType,
    buildingType: listing.buildingType,
    condition: listing.condition,
    sellerType: listing.sellerType,
    contactName: listing.contactName,
    contactPhone: listing.contactPhone,
    availableFrom: toIsoString(listing.availableFrom),
    updatedAt: toIsoString(listing.sourceUpdatedAt),
    photos: listing.photos.map(mapListingPhoto),
    features: listing.features.map(mapListingFeature),
  };
}
