export const marketplaces = ["SELECTED_MARKETPLACE"] as const;
export const propertyTypes = ["APARTMENT"] as const;
export const currencyCodes = ["PLN"] as const;
export const transactionTypes = ["SALE", "RENT"] as const;
export const publicationStatuses = [
  "PUBLISHED",
  "REJECTED",
  "NEEDS_REVIEW",
  "DUPLICATE",
  "EXPIRED",
] as const;
export const ingestionStages = [
  "DISCOVERY",
  "FETCH",
  "PARSE",
  "NORMALIZE",
  "VALIDATE",
  "DEDUPLICATE",
  "PERSIST",
] as const;
export const ingestionResults = ["SUCCESS", "FAILED", "REJECTED", "DUPLICATE"] as const;
export const importRunStatuses = [
  "RUNNING",
  "COMPLETED",
  "COMPLETED_WITH_ERRORS",
  "FAILED",
] as const;
export const featureValueTypes = ["BOOLEAN", "NUMBER", "TEXT"] as const;
export const listingFeatureKeys = [
  "BALCONY",
  "ELEVATOR",
  "PARKING",
  "GARAGE",
  "TERRACE",
  "GARDEN",
  "FURNISHED",
  "PET_FRIENDLY",
  "AIR_CONDITIONING",
  "STORAGE_ROOM",
  "SECURITY",
  "GATED_PROPERTY",
] as const;
export const listingSortOptions = [
  "newest",
  "price_asc",
  "price_desc",
  "area_asc",
  "area_desc",
] as const;

export type Marketplace = (typeof marketplaces)[number];
export type PropertyType = (typeof propertyTypes)[number];
export type CurrencyCode = (typeof currencyCodes)[number];
export type TransactionType = (typeof transactionTypes)[number];
export type PublicationStatus = (typeof publicationStatuses)[number];
export type IngestionStage = (typeof ingestionStages)[number];
export type IngestionResult = (typeof ingestionResults)[number];
export type ImportRunStatus = (typeof importRunStatuses)[number];
export type FeatureValueType = (typeof featureValueTypes)[number];
export type ListingFeatureKey = (typeof listingFeatureKeys)[number];
export type ListingSortOption = (typeof listingSortOptions)[number];
