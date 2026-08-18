import {
  currencyCodes,
  listingFeatureKeys,
  marketplaces,
  transactionTypes,
  type CurrencyCode,
  type ListingFeatureKey,
  type Marketplace,
  type PublicationStatus,
  type TransactionType,
} from "@/modules/listings/constants";
import { formatDecimal, roundToStep } from "@/shared/utils/decimal";

const marketplace: Marketplace = marketplaces[0];
const currency: CurrencyCode = currencyCodes[0];

interface SeedPhotoRecord {
  readonly url: string;
  readonly position: number;
  readonly isPrimary: boolean;
}

interface SeedFeatureRecord {
  readonly key: ListingFeatureKey;
  readonly valueType: "BOOLEAN";
  readonly booleanValue: boolean;
  readonly rawValue: string;
}

export interface SeedListingRecord {
  readonly source: Marketplace;
  readonly sourceListingId: string;
  readonly sourceUrl: string;
  readonly sourceUrlCanonical: string;
  readonly sourceContentHash: string;
  readonly propertyType: "APARTMENT";
  readonly transactionType: TransactionType;
  readonly publicationStatus: PublicationStatus;
  readonly rejectionReason: string | null;
  readonly title: string;
  readonly descriptionRaw: string;
  readonly descriptionClean: string;
  readonly descriptionSummary: string | null;
  readonly priceAmount: string | null;
  readonly currency: CurrencyCode | null;
  readonly administrativeFee: string | null;
  readonly depositAmount: string | null;
  readonly utilitiesDescription: string | null;
  readonly areaM2: string | null;
  readonly rooms: number | null;
  readonly city: string;
  readonly district: string | null;
  readonly street: string | null;
  readonly floor: number | null;
  readonly floorCount: number | null;
  readonly buildingYear: number | null;
  readonly marketType: string | null;
  readonly ownershipType: string | null;
  readonly buildingType: string | null;
  readonly heatingType: string | null;
  readonly condition: string | null;
  readonly sellerType: string | null;
  readonly availableFrom: string | null;
  readonly sourcePublishedAt: string;
  readonly sourceUpdatedAt: string;
  readonly scrapedAt: string;
  readonly contactName: string | null;
  readonly contactPhone: string | null;
  readonly rawAttributes: Record<string, unknown>;
  readonly rawPayload: Record<string, unknown>;
  readonly qualityScore: number | null;
  readonly completenessScore: number | null;
  readonly consistencyScore: number | null;
  readonly duplicateGroupId: string | null;
  readonly isPrimary: boolean;
  readonly photos: SeedPhotoRecord[];
  readonly features: SeedFeatureRecord[];
}

export interface SeedImportRunRecord {
  readonly source: Marketplace;
  readonly startedAt: string;
  readonly finishedAt: string;
  readonly status: "COMPLETED_WITH_ERRORS";
  readonly configuration: Record<string, unknown>;
  readonly candidatesDiscovered: number;
  readonly pagesFetched: number;
  readonly parsedCount: number;
  readonly normalizedCount: number;
  readonly publishedCount: number;
  readonly rejectedCount: number;
  readonly needsReviewCount: number;
  readonly duplicateCount: number;
  readonly failedCount: number;
}

export interface SeedIssueRecord {
  readonly listingSourceListingId: string | null;
  readonly sourceUrl: string;
  readonly stage:
    | "FETCH"
    | "PARSE"
    | "NORMALIZE"
    | "VALIDATE"
    | "DEDUPLICATE"
    | "PERSIST";
  readonly result: "FAILED" | "REJECTED" | "DUPLICATE";
  readonly code: string;
  readonly message: string;
  readonly context: Record<string, unknown>;
}

export interface SeedDataset {
  readonly listings: SeedListingRecord[];
  readonly importRun: SeedImportRunRecord;
  readonly issues: SeedIssueRecord[];
  readonly summary: {
    readonly totalListings: number;
    readonly publicPrimaryCount: number;
    readonly salePrimaryCount: number;
    readonly rentPrimaryCount: number;
    readonly statusCounts: Record<PublicationStatus, number>;
  };
}

interface CityDefinition {
  readonly city: string;
  readonly slug: string;
  readonly salePerM2: number;
  readonly rentPerM2: number;
  readonly districts: readonly string[];
  readonly streets: readonly string[];
}

const cityDefinitions: readonly CityDefinition[] = [
  {
    city: "Kraków",
    slug: "krakow",
    salePerM2: 15800,
    rentPerM2: 78,
    districts: ["Podgórze", "Krowodrza", "Prądnik Biały", "Grzegórzki"],
    streets: ["ul. Mogilska", "ul. Klimeckiego", "ul. Wrocławska", "ul. Mazowiecka"],
  },
  {
    city: "Warszawa",
    slug: "warszawa",
    salePerM2: 18700,
    rentPerM2: 94,
    districts: ["Mokotów", "Wola", "Praga-Południe", "Żoliborz"],
    streets: ["ul. Woronicza", "ul. Kasprzaka", "ul. Gdecka", "ul. Rydygiera"],
  },
  {
    city: "Wrocław",
    slug: "wroclaw",
    salePerM2: 13900,
    rentPerM2: 72,
    districts: ["Krzyki", "Fabryczna", "Śródmieście", "Psie Pole"],
    streets: ["ul. Powstańców Śląskich", "ul. Legnicka", "ul. Słonimskiego", "ul. Nyska"],
  },
  {
    city: "Gdańsk",
    slug: "gdansk",
    salePerM2: 15100,
    rentPerM2: 80,
    districts: ["Wrzeszcz", "Przymorze", "Letnica", "Ujeścisko"],
    streets: ["ul. Grudziądzka", "ul. Obrońców Wybrzeża", "ul. Starowiejska", "ul. Piecewska"],
  },
] as const;

const saleTargetsByCity: Record<string, number> = {
  Kraków: 13,
  Warszawa: 13,
  "Wrocław": 12,
  "Gdańsk": 12,
};

const rentTargetsByCity: Record<string, number> = {
  Kraków: 12,
  Warszawa: 12,
  "Wrocław": 13,
  "Gdańsk": 13,
};

function createHash(input: string): number {
  let hash = 2166136261;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function createRng(seed: string): () => number {
  let state = createHash(seed);

  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function pickFrom<T>(items: readonly T[], rng: () => number): T {
  const index = Math.floor(rng() * items.length);
  const selectedItem = items[index] ?? items[0];

  if (selectedItem === undefined) {
    throw new Error("Cannot pick from an empty collection.");
  }

  return selectedItem;
}

function buildIsoDate(dayOffset: number, hour: number): string {
  return new Date(Date.UTC(2026, 5, 1 + dayOffset, hour, 0, 0)).toISOString();
}

function inferRooms(area: number, rng: () => number): number {
  if (area < 36) {
    return 1;
  }

  if (area < 52) {
    return rng() < 0.35 ? 1 : 2;
  }

  if (area < 70) {
    return rng() < 0.3 ? 2 : 3;
  }

  if (area < 90) {
    return rng() < 0.5 ? 3 : 4;
  }

  return rng() < 0.45 ? 4 : 5;
}

function createFeatureRecords(
  transactionType: TransactionType,
  rng: () => number,
): SeedFeatureRecord[] {
  const availableKeys = [...listingFeatureKeys];
  const selectedKeys: ListingFeatureKey[] = [];
  const targetCount = transactionType === "RENT" ? 4 : 3;

  while (selectedKeys.length < targetCount && availableKeys.length > 0) {
    const index = Math.floor(rng() * availableKeys.length);
    const [selectedKey] = availableKeys.splice(index, 1);

    if (selectedKey !== undefined) {
      selectedKeys.push(selectedKey);
    }
  }

  return selectedKeys.map((key) => ({
    key,
    valueType: "BOOLEAN",
    booleanValue: true,
    rawValue: "tak",
  }));
}

const seedPhotoPool = [
  "https://d-gr.cdngr.pl/kadry/k/r/gr-ogl/94/7b/48467451_1540435875_mieszkanie-krakow-krowodrza-ul-krowoderskich-zuchow.jpg",
  "https://d-gr.cdngr.pl/kadry/k/r/gr-ogl/94/7b/48467451_1540435879_mieszkanie-krakow-krowodrza-ul-krowoderskich-zuchow.jpg",
  "https://d-gr.cdngr.pl/kadry/k/r/gr-ogl/20/05/48467447_1540435781_mieszkanie-krakow-krowodrza-ul-zbozowa.jpg",
  "https://d-gr.cdngr.pl/kadry/k/r/gr-ogl/20/05/48467447_1540435795_mieszkanie-krakow-krowodrza-ul-zbozowa.jpg",
] as const;

function createPhotos(sourceListingId: string, count: number): SeedPhotoRecord[] {
  const startIndex = createHash(sourceListingId) % seedPhotoPool.length;

  return Array.from({ length: count }, (_, index) => ({
    url: `${seedPhotoPool[(startIndex + index) % seedPhotoPool.length] ?? seedPhotoPool[0]}#${sourceListingId}-${index + 1}`,
    position: index,
    isPrimary: index === 0,
  }));
}

function createPublishedPrimaryListing(
  cityDefinition: CityDefinition,
  transactionType: TransactionType,
  index: number,
  duplicateGroupId: string | null,
): SeedListingRecord {
  const rng = createRng(`home4u-db:${cityDefinition.slug}:${transactionType}:${index}`);
  const areaBase = transactionType === "SALE" ? 34 + rng() * 58 : 28 + rng() * 44;
  const area = roundToStep(areaBase, 0.1);
  const rooms = inferRooms(area, rng);
  const pricePerM2OrMonth =
    transactionType === "SALE"
      ? cityDefinition.salePerM2 * (0.92 + rng() * 0.22)
      : cityDefinition.rentPerM2 * (0.9 + rng() * 0.18);
  const price =
    transactionType === "SALE"
      ? roundToStep(area * pricePerM2OrMonth, 100)
      : roundToStep(area * pricePerM2OrMonth, 50);
  const adminFee =
    transactionType === "RENT" && rng() < 0.7 ? roundToStep(420 + rng() * 680, 10) : null;
  const deposit =
    transactionType === "RENT" && rng() < 0.75
      ? roundToStep(price * (rng() < 0.5 ? 1 : 1.5), 50)
      : null;
  const floorCount = Math.max(2, Math.floor(3 + rng() * 6));
  const floor = Math.floor(rng() * (floorCount + 1)) - 1;
  const sourceListingId = `${transactionType.toLowerCase()}-${cityDefinition.slug}-${String(index + 1).padStart(3, "0")}`;
  const district = pickFrom(cityDefinition.districts, rng);
  const street = pickFrom(cityDefinition.streets, rng);
  const buildingYear = 1998 + Math.floor(rng() * 27);
  const sourcePublishedAt = buildIsoDate(index + Math.floor(rng() * 14), 9);
  const sourceUpdatedAt = buildIsoDate(index + 20 + Math.floor(rng() * 14), 11);
  const scrapedAt = buildIsoDate(index + 34 + Math.floor(rng() * 8), 13);
  const titlePrefix = transactionType === "SALE" ? "Na sprzedaż" : "Do wynajęcia";
  const sellerType = rng() < 0.62 ? "biuro nieruchomości" : "osoba prywatna";
  const generatedFeatures = createFeatureRecords(transactionType, rng);
  // Keep one deterministic listing for the natural-search acceptance example:
  // a roughly 30 m² Kraków rental with a balcony.
  const features =
    cityDefinition.city === "Kraków" && transactionType === "RENT" && index === 10
      ? [
          ...generatedFeatures.slice(0, -1),
          {
            key: "BALCONY" as const,
            valueType: "BOOLEAN" as const,
            booleanValue: true,
            rawValue: "tak",
          },
        ]
      : generatedFeatures;
  const photos = createPhotos(sourceListingId, 3 + Math.floor(rng() * 3));

  return {
    source: marketplace,
    sourceListingId,
    sourceUrl: `https://listings.home4u.test/${cityDefinition.slug}/${transactionType.toLowerCase()}/${sourceListingId}`,
    sourceUrlCanonical: `https://listings.home4u.test/${cityDefinition.slug}/${transactionType.toLowerCase()}/${sourceListingId}`,
    sourceContentHash: `hash-${sourceListingId}`,
    propertyType: "APARTMENT",
    transactionType,
    publicationStatus: "PUBLISHED",
    rejectionReason: null,
    title: `${titlePrefix} mieszkanie ${rooms}-pokojowe, ${district}`,
    descriptionRaw: `${titlePrefix} mieszkanie w dzielnicy ${district}. Jasny układ, ${formatDecimal(area, 1)} m², ${rooms} pokoje.`,
    descriptionClean: `${titlePrefix} mieszkanie w ${cityDefinition.city}, dzielnica ${district}, ${formatDecimal(area, 1)} m² i ${rooms} pokoje.`,
    descriptionSummary: rng() < 0.35 ? `Układ ${rooms}-pokojowy w ${district}.` : null,
    priceAmount: formatDecimal(price),
    currency,
    administrativeFee: adminFee === null ? null : formatDecimal(adminFee),
    depositAmount: deposit === null ? null : formatDecimal(deposit),
    utilitiesDescription:
      transactionType === "RENT" && rng() < 0.45 ? "media według zużycia" : null,
    areaM2: formatDecimal(area, 1),
    rooms,
    city: cityDefinition.city,
    district,
    street: rng() < 0.88 ? street : null,
    floor: floor < 0 ? 0 : floor,
    floorCount,
    buildingYear: rng() < 0.8 ? buildingYear : null,
    marketType: transactionType === "SALE" ? (rng() < 0.55 ? "wtórny" : "pierwotny") : null,
    ownershipType: transactionType === "SALE" && rng() < 0.8 ? "pełna własność" : null,
    buildingType: pickFrom(["blok", "apartamentowiec", "kamienica"] as const, rng),
    heatingType: pickFrom(["miejskie", "gazowe"] as const, rng),
    condition: pickFrom(["do zamieszkania", "bardzo dobry", "do odświeżenia"] as const, rng),
    sellerType,
    availableFrom:
      transactionType === "RENT" ? buildIsoDate(70 + index + Math.floor(rng() * 14), 8) : null,
    sourcePublishedAt,
    sourceUpdatedAt,
    scrapedAt,
    contactName: sellerType === "biuro nieruchomości" ? "Biuro Home4u" : "Właściciel",
    contactPhone: rng() < 0.7 ? `+48 50${Math.floor(1000000 + rng() * 8999999)}` : null,
    rawAttributes: {
      Powierzchnia: `${formatDecimal(area, 1)} m²`,
      "Liczba pokoi": String(rooms),
      Piętro: `${floor < 0 ? 0 : floor}/${floorCount}`,
      "Stan wykończenia": pickFrom(["do zamieszkania", "bardzo dobry", "do odświeżenia"] as const, rng),
      Ogrzewanie: pickFrom(["miejskie", "gazowe"] as const, rng),
      Winda: features.some((feature) => feature.key === "ELEVATOR") ? "tak" : "nie",
      Balkon: features.some((feature) => feature.key === "BALCONY") ? "tak" : "nie",
    },
    rawPayload: {
      source: marketplace,
      city: cityDefinition.city,
      transactionType,
      generatorVersion: "v1",
      sequence: index + 1,
    },
    qualityScore: 78 + Math.floor(rng() * 18),
    completenessScore: 74 + Math.floor(rng() * 22),
    consistencyScore: 80 + Math.floor(rng() * 18),
    duplicateGroupId,
    isPrimary: true,
    photos,
    features,
  };
}

function createDuplicateListing(primary: SeedListingRecord, sequence: number): SeedListingRecord {
  const duplicateSourceListingId = `${primary.sourceListingId}-dup-${sequence}`;

  return {
    ...primary,
    sourceListingId: duplicateSourceListingId,
    sourceUrl: `${primary.sourceUrl}-dup-${sequence}`,
    sourceUrlCanonical: `${primary.sourceUrlCanonical}-dup-${sequence}`,
    sourceContentHash: `${primary.sourceContentHash}-dup-${sequence}`,
    publicationStatus: "DUPLICATE",
    title: `${primary.title} (duplikat)`,
    qualityScore: primary.qualityScore === null ? null : Math.max(55, primary.qualityScore - 8),
    completenessScore:
      primary.completenessScore === null ? null : Math.max(55, primary.completenessScore - 6),
    consistencyScore:
      primary.consistencyScore === null ? null : Math.max(55, primary.consistencyScore - 4),
    isPrimary: false,
    photos: createPhotos(duplicateSourceListingId, primary.photos.length),
  };
}

function createNeedsReviewListing(
  cityDefinition: CityDefinition,
  transactionType: TransactionType,
  sequence: number,
): SeedListingRecord {
  const base = createPublishedPrimaryListing(cityDefinition, transactionType, 80 + sequence, null);
  const suspiciousPrice =
    transactionType === "SALE" ? formatDecimal(149000) : formatDecimal(950);

  return {
    ...base,
    sourceListingId: `review-${cityDefinition.slug}-${transactionType.toLowerCase()}-${sequence + 1}`,
    sourceUrl: `${base.sourceUrl}-review-${sequence + 1}`,
    sourceUrlCanonical: `${base.sourceUrlCanonical}-review-${sequence + 1}`,
    sourceContentHash: `${base.sourceContentHash}-review-${sequence + 1}`,
    publicationStatus: "NEEDS_REVIEW",
    title: `${base.title} - wymaga weryfikacji`,
    priceAmount: suspiciousPrice,
    qualityScore: 60,
    completenessScore: 72,
    consistencyScore: 49,
    duplicateGroupId: null,
    isPrimary: true,
  };
}

function createRejectedListing(
  cityDefinition: CityDefinition,
  transactionType: TransactionType,
  sequence: number,
): SeedListingRecord {
  const base = createPublishedPrimaryListing(cityDefinition, transactionType, 90 + sequence, null);

  return {
    ...base,
    sourceListingId: `rejected-${cityDefinition.slug}-${transactionType.toLowerCase()}-${sequence + 1}`,
    sourceUrl: `${base.sourceUrl}-rejected-${sequence + 1}`,
    sourceUrlCanonical: `${base.sourceUrlCanonical}-rejected-${sequence + 1}`,
    sourceContentHash: `${base.sourceContentHash}-rejected-${sequence + 1}`,
    publicationStatus: "REJECTED",
    rejectionReason: sequence % 2 === 0 ? "MISSING_PRICE" : "NO_USABLE_PHOTO",
    priceAmount: sequence % 2 === 0 ? null : base.priceAmount,
    currency: sequence % 2 === 0 ? null : base.currency,
    qualityScore: 42,
    completenessScore: 48,
    consistencyScore: 68,
    isPrimary: false,
    photos: sequence % 2 === 0 ? base.photos : [],
  };
}

export function createSeedDataset(): SeedDataset {
  const publishedListings: SeedListingRecord[] = [];

  for (const cityDefinition of cityDefinitions) {
    const saleTarget = saleTargetsByCity[cityDefinition.city] ?? 0;
    const rentTarget = rentTargetsByCity[cityDefinition.city] ?? 0;

    for (let index = 0; index < saleTarget; index += 1) {
      const duplicateGroupId = publishedListings.length < 4 ? `dup-group-${publishedListings.length + 1}` : null;
      publishedListings.push(
        createPublishedPrimaryListing(cityDefinition, "SALE", index, duplicateGroupId),
      );
    }

    for (let index = 0; index < rentTarget; index += 1) {
      const duplicateGroupId = publishedListings.length < 4 ? `dup-group-${publishedListings.length + 1}` : null;
      publishedListings.push(
        createPublishedPrimaryListing(cityDefinition, "RENT", index, duplicateGroupId),
      );
    }
  }

  const duplicateListings = publishedListings
    .filter((listing) => listing.duplicateGroupId !== null)
    .slice(0, 4)
    .map((listing, index) => createDuplicateListing(listing, index + 1));

  const needsReviewListings = cityDefinitions.map((cityDefinition, index) =>
    createNeedsReviewListing(cityDefinition, index % 2 === 0 ? "SALE" : "RENT", index),
  );

  const rejectedListings = cityDefinitions.map((cityDefinition, index) =>
    createRejectedListing(cityDefinition, index % 2 === 0 ? "RENT" : "SALE", index),
  );

  const listings = [...publishedListings, ...duplicateListings, ...needsReviewListings, ...rejectedListings];

  const statusCounts = listings.reduce<Record<PublicationStatus, number>>(
    (accumulator, listing) => {
      accumulator[listing.publicationStatus] += 1;
      return accumulator;
    },
    {
      PUBLISHED: 0,
      REJECTED: 0,
      NEEDS_REVIEW: 0,
      DUPLICATE: 0,
      EXPIRED: 0,
    },
  );

  const issues: SeedIssueRecord[] = [
    ...duplicateListings.map((listing) => ({
      listingSourceListingId: listing.sourceListingId,
      sourceUrl: listing.sourceUrl,
      stage: "DEDUPLICATE" as const,
      result: "DUPLICATE" as const,
      code: "PROBABLE_DUPLICATE",
      message: "Listing grouped into an existing duplicate cluster.",
      context: {
        duplicateGroupId: listing.duplicateGroupId,
      },
    })),
    ...needsReviewListings.map((listing) => ({
      listingSourceListingId: listing.sourceListingId,
      sourceUrl: listing.sourceUrl,
      stage: "VALIDATE" as const,
      result: "FAILED" as const,
      code: "SUSPICIOUS_PRICE",
      message: "Listing price requires manual verification.",
      context: {
        publicationStatus: listing.publicationStatus,
        priceAmount: listing.priceAmount,
      },
    })),
    ...rejectedListings.map((listing) => ({
      listingSourceListingId: listing.sourceListingId,
      sourceUrl: listing.sourceUrl,
      stage: "VALIDATE" as const,
      result: "REJECTED" as const,
      code: listing.rejectionReason ?? "REJECTED",
      message: "Listing did not meet publication requirements.",
      context: {
        rejectionReason: listing.rejectionReason,
      },
    })),
    {
      listingSourceListingId: null,
      sourceUrl: "https://listings.home4u.test/fetch-failure/1",
      stage: "FETCH",
      result: "FAILED",
      code: "HTTP_503",
      message: "Temporary upstream error while fetching a candidate listing.",
      context: {
        attemptCount: 3,
      },
    },
    {
      listingSourceListingId: null,
      sourceUrl: "https://listings.home4u.test/parse-failure/1",
      stage: "PARSE",
      result: "FAILED",
      code: "MISSING_EMBEDDED_STATE",
      message: "The candidate page could not be parsed deterministically.",
      context: {
        htmlFixtureAvailable: false,
      },
    },
  ];

  return {
    listings,
    importRun: {
      source: marketplace,
      startedAt: buildIsoDate(0, 6),
      finishedAt: buildIsoDate(1, 7),
      status: "COMPLETED_WITH_ERRORS",
      configuration: {
        source: marketplace,
        cities: cityDefinitions.map((cityDefinition) => cityDefinition.slug),
        targetSale: 50,
        targetRent: 50,
        maxCandidates: 250,
        seed: "real-estate-mvp-v1",
      },
      candidatesDiscovered: 148,
      pagesFetched: 132,
      parsedCount: 112,
      normalizedCount: 112,
      publishedCount: statusCounts.PUBLISHED,
      rejectedCount: statusCounts.REJECTED,
      needsReviewCount: statusCounts.NEEDS_REVIEW,
      duplicateCount: statusCounts.DUPLICATE,
      failedCount: 2,
    },
    issues,
    summary: {
      totalListings: listings.length,
      publicPrimaryCount: listings.filter(
        (listing) => listing.publicationStatus === "PUBLISHED" && listing.isPrimary,
      ).length,
      salePrimaryCount: listings.filter(
        (listing) =>
          listing.publicationStatus === "PUBLISHED" &&
          listing.isPrimary &&
          listing.transactionType === transactionTypes[0],
      ).length,
      rentPrimaryCount: listings.filter(
        (listing) =>
          listing.publicationStatus === "PUBLISHED" &&
          listing.isPrimary &&
          listing.transactionType === transactionTypes[1],
      ).length,
      statusCounts,
    },
  };
}
