import type {
  CurrencyCode,
  Marketplace,
  PropertyType,
} from "@/modules/listings/constants";
import {
  currencyCodes,
  marketplaces,
  propertyTypes,
} from "@/modules/listings/constants";
import { cleanDescription, extractDescriptionRaw } from "@/modules/ingestion/normalize/description";
import {
  extractDistrictFromLocationText,
  normalizeApartmentArea,
  normalizeCityName,
  normalizeDate,
  normalizeFloorInfo,
  normalizePhoneNumber,
  normalizePlnPrice,
  normalizeRoomCount,
  normalizeTransactionType,
} from "@/modules/ingestion/normalize/values";
import type { RawSourceListing } from "@/modules/ingestion/schemas";
import type {
  FieldConflict,
  FieldProvenance,
  IngestionWarning,
  NormalizationCandidate,
  NormalizationSource,
  NormalizedIngestionListing,
} from "@/modules/ingestion/types";

function getRecordValue(
  input: unknown,
  key: string,
): unknown {
  if (typeof input !== "object" || input === null) {
    return null;
  }

  return key in input ? (input as Record<string, unknown>)[key] : null;
}

interface ResolvedField<T> {
  readonly value: T | null;
  readonly provenance: FieldProvenance<T> | null;
  readonly conflicts: FieldConflict<T>[];
  readonly warnings: IngestionWarning[];
}

function canonicalizeUrl(input: string): string {
  const url = new URL(input);

  url.hash = "";
  const removableQueryParameters = [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
  ];

  for (const parameter of removableQueryParameters) {
    url.searchParams.delete(parameter);
  }

  const normalizedPath = url.pathname.replace(/\/+$/, "");

  url.pathname = normalizedPath.length === 0 ? "/" : normalizedPath;
  return url.toString();
}

function createCandidate<T>(
  field: string,
  source: NormalizationSource,
  sourcePath: string,
  raw: unknown,
  normalized: T | null,
  reliability: number,
): NormalizationCandidate<T> {
  return {
    field,
    source,
    sourcePath,
    raw,
    normalized,
    reliability,
  };
}

function resolveCandidates<T>(
  field: string,
  candidates: NormalizationCandidate<T>[],
): ResolvedField<T> {
  const usableCandidates = candidates.filter(
    (candidate) => candidate.normalized !== null,
  ) as Array<NormalizationCandidate<T> & { normalized: T }>;
  const sortedCandidates = [...usableCandidates].sort((left, right) => {
    if (right.reliability !== left.reliability) {
      return right.reliability - left.reliability;
    }

    return left.sourcePath.localeCompare(right.sourcePath);
  });
  const chosen = sortedCandidates[0] ?? null;
  const warnings: IngestionWarning[] = [];
  const conflicts: FieldConflict<T>[] = [];

  if (chosen !== null) {
    const conflictingCandidates = sortedCandidates.filter(
      (candidate) => candidate.normalized !== chosen.normalized,
    );

    if (conflictingCandidates.length > 0) {
      conflicts.push({
        field,
        chosenValue: chosen.normalized,
        chosenSource: chosen.source,
        candidates: sortedCandidates.map((candidate) => ({
          source: candidate.source,
          sourcePath: candidate.sourcePath,
          raw: candidate.raw,
          normalized: candidate.normalized,
        })),
      });
      warnings.push({
        code: `${field.toUpperCase()}_CONFLICT`,
        message: `Conflicting ${field} values were found during normalization.`,
        severity: "WARNING",
      });
    }
  }

  return {
    value: chosen?.normalized ?? null,
    provenance:
      chosen === null
        ? null
        : {
            field,
            source: chosen.source,
            sourcePath: chosen.sourcePath,
            raw: chosen.raw,
            normalized: chosen.normalized,
          },
    conflicts,
    warnings,
  };
}

function detectPropertyType(raw: RawSourceListing): PropertyType | null {
  const text = `${raw.title ?? ""} ${raw.description ?? ""} ${raw.locationText ?? ""}`.toLowerCase();

  if (/\b(dom|dzialka)\b/.test(text)) {
    return null;
  }

  // Bare "lokal" is ambiguous: descriptions routinely use it as a plain
  // synonym for the apartment unit itself ("lokal został wykończony..."),
  // not just commercial premises. Only the qualified phrase reliably means
  // "not an apartment".
  if (/\blokal\s+(użytkowy|usługowy|handlowy|biurowy)\b/.test(text)) {
    return null;
  }

  if (/\b(mieszkanie|apartament)\b/.test(text)) {
    return propertyTypes[0];
  }

  return null;
}

function createWarning(
  code: string,
  message: string,
  severity: "INFO" | "WARNING" | "CRITICAL" = "WARNING",
): IngestionWarning {
  return {
    code,
    message,
    severity,
  };
}

export function normalizeRawListing(rawListing: RawSourceListing): NormalizedIngestionListing {
  const warnings: IngestionWarning[] = rawListing.extractionWarnings.map((warning) =>
    createWarning(warning.code, warning.message),
  );
  const conflicts: FieldConflict[] = [];
  const provenance: FieldProvenance[] = [];
  const source: Marketplace = rawListing.source ?? marketplaces[0];
  const rawAttributes = rawListing.attributes;
  const photos = rawListing.photos
    .filter((photo) => /^https?:\/\//.test(photo))
    .map((photo, index) => ({
      url: photo,
      position: index,
      isPrimary: index === 0,
    }));

  const priceCandidates = [
    createCandidate(
      "priceAmount",
      "SOURCE_FIELD",
      "priceText",
      rawListing.priceText,
      normalizePlnPrice(rawListing.priceText).value,
      100,
    ),
    createCandidate(
      "priceAmount",
      "ATTRIBUTE",
      "attributes.Cena",
      rawAttributes.Cena ?? null,
      normalizePlnPrice(typeof rawAttributes.Cena === "string" ? rawAttributes.Cena : null).value,
      90,
    ),
    createCandidate(
      "priceAmount",
      "STRUCTURED_DATA",
      "structuredData.price",
      getRecordValue(rawListing.structuredData, "price"),
      normalizePlnPrice(
        typeof getRecordValue(rawListing.structuredData, "price") === "string"
          ? String(getRecordValue(rawListing.structuredData, "price"))
          : null,
      ).value,
      80,
    ),
  ];
  const areaCandidates = [
    createCandidate(
      "areaM2",
      "ATTRIBUTE",
      "attributes.Powierzchnia",
      rawAttributes.Powierzchnia ?? null,
      normalizeApartmentArea(
        typeof rawAttributes.Powierzchnia === "string" ? rawAttributes.Powierzchnia : null,
      ).value,
      100,
    ),
    createCandidate(
      "areaM2",
      "STRUCTURED_DATA",
      "structuredData.floorSize",
      getRecordValue(rawListing.structuredData, "floorSize"),
      normalizeApartmentArea(
        typeof getRecordValue(rawListing.structuredData, "floorSize") === "string"
          ? String(getRecordValue(rawListing.structuredData, "floorSize"))
          : null,
      ).value,
      80,
    ),
  ];
  const roomCandidates = [
    createCandidate(
      "rooms",
      "ATTRIBUTE",
      "attributes.Liczba pokoi",
      rawAttributes["Liczba pokoi"] ?? null,
      normalizeRoomCount(
        typeof rawAttributes["Liczba pokoi"] === "string"
          ? rawAttributes["Liczba pokoi"]
          : null,
      ).value,
      100,
    ),
    createCandidate(
      "rooms",
      "STRUCTURED_DATA",
      "structuredData.numberOfRooms",
      getRecordValue(rawListing.structuredData, "numberOfRooms"),
      normalizeRoomCount(
        typeof getRecordValue(rawListing.structuredData, "numberOfRooms") === "string" ||
          typeof getRecordValue(rawListing.structuredData, "numberOfRooms") === "number"
          ? (getRecordValue(rawListing.structuredData, "numberOfRooms") as string | number)
          : null,
      ).value,
      80,
    ),
    createCandidate(
      "rooms",
      "TITLE",
      "title",
      rawListing.title,
      normalizeRoomCount(rawListing.title).value,
      40,
    ),
  ];
  const cityCandidates = [
    createCandidate(
      "city",
      "LOCATION_TEXT",
      "locationText",
      rawListing.locationText,
      normalizeCityName(rawListing.locationText).value,
      100,
    ),
    createCandidate(
      "city",
      "STRUCTURED_DATA",
      "structuredData.addressLocality",
      getRecordValue(rawListing.structuredData, "addressLocality"),
      normalizeCityName(
        typeof getRecordValue(rawListing.structuredData, "addressLocality") === "string"
          ? String(getRecordValue(rawListing.structuredData, "addressLocality"))
          : null,
      ).value,
      85,
    ),
  ];
  const transactionCandidates = [
    createCandidate(
      "transactionType",
      "SOURCE_FIELD",
      "transactionTypeHint",
      rawListing.transactionTypeHint,
      rawListing.transactionTypeHint,
      100,
    ),
    createCandidate(
      "transactionType",
      "TITLE",
      "title",
      rawListing.title,
      normalizeTransactionType(rawListing.title).value,
      50,
    ),
    createCandidate(
      "transactionType",
      "DESCRIPTION",
      "description",
      rawListing.description,
      normalizeTransactionType(rawListing.description).value,
      40,
    ),
  ];
  const floorCandidates = [
    createCandidate(
      "floorInfo",
      "ATTRIBUTE",
      "attributes.Piętro",
      rawAttributes.Piętro ?? null,
      normalizeFloorInfo(typeof rawAttributes.Piętro === "string" ? rawAttributes.Piętro : null),
      100,
    ),
  ];
  const phoneCandidate = normalizePhoneNumber(rawListing.contactPhone);
  const publishedDateCandidate = normalizeDate(String(getRecordValue(rawListing.rawPayload, "publishedAt") ?? ""));

  const resolvedPrice = resolveCandidates("priceAmount", priceCandidates);
  const resolvedArea = resolveCandidates("areaM2", areaCandidates);
  const resolvedRooms = resolveCandidates("rooms", roomCandidates);
  const resolvedCity = resolveCandidates("city", cityCandidates);
  const resolvedTransaction = resolveCandidates("transactionType", transactionCandidates);
  const resolvedFloor = resolveCandidates("floorInfo", floorCandidates);

  const descriptionRaw = extractDescriptionRaw(rawListing.description);
  const descriptionClean = cleanDescription(rawListing.description);
  const title = rawListing.title?.trim() || null;
  const propertyType = detectPropertyType(rawListing);
  const currency: CurrencyCode | null = resolvedPrice.value === null ? null : currencyCodes[0];
  const sourceUrlCanonical = canonicalizeUrl(rawListing.sourceUrl);
  const district =
    (typeof rawAttributes.Dzielnica === "string" ? rawAttributes.Dzielnica.trim() || null : null) ??
    extractDistrictFromLocationText(rawListing.locationText, resolvedCity.value);
  const street =
    typeof rawAttributes.Ulica === "string" ? rawAttributes.Ulica.trim() || null : null;
  const hasBalcony =
    typeof rawAttributes.Balkon === "string" && rawAttributes.Balkon.trim().toLowerCase() === "tak";

  const fieldProvenanceEntries = [
      resolvedPrice.provenance,
      resolvedArea.provenance,
      resolvedRooms.provenance,
      resolvedCity.provenance,
      resolvedTransaction.provenance,
      resolvedFloor.provenance,
    ].filter((item): item is Exclude<typeof item, null> => item !== null);

  provenance.push(...fieldProvenanceEntries);
  conflicts.push(
    ...resolvedPrice.conflicts,
    ...resolvedArea.conflicts,
    ...resolvedRooms.conflicts,
    ...resolvedCity.conflicts,
    ...resolvedTransaction.conflicts,
  );
  warnings.push(
    ...resolvedPrice.warnings,
    ...resolvedArea.warnings,
    ...resolvedRooms.warnings,
    ...resolvedCity.warnings,
    ...resolvedTransaction.warnings,
  );

  if (phoneCandidate.warning !== null) {
    warnings.push(createWarning(phoneCandidate.warning, "Phone number could not be normalized."));
  }

  if (publishedDateCandidate.warning !== null && publishedDateCandidate.warning !== "UNPARSEABLE_DATE") {
    warnings.push(createWarning(publishedDateCandidate.warning, "Published date could not be normalized."));
  }

  return {
    source,
    sourceListingId: rawListing.sourceListingId,
    sourceUrl: rawListing.sourceUrl,
    sourceUrlCanonical,
    sourceContentHash: rawListing.contentHash,
    propertyType,
    transactionType: resolvedTransaction.value,
    title,
    descriptionRaw,
    descriptionClean,
    priceAmount: resolvedPrice.value,
    currency,
    areaM2: resolvedArea.value,
    rooms: resolvedRooms.value,
    city: resolvedCity.value,
    district,
    street,
    latitude: rawListing.latitude,
    longitude: rawListing.longitude,
    floor:
      resolvedFloor.value === null ? null : (resolvedFloor.value as { floor: number | null }).floor,
    floorCount:
      resolvedFloor.value === null
        ? null
        : (resolvedFloor.value as { floorCount: number | null }).floorCount,
    hasBalcony,
    availableFrom: normalizeDate(
      typeof rawAttributes["Dostępne od"] === "string" ? rawAttributes["Dostępne od"] : null,
    ).value,
    sourcePublishedAt: publishedDateCandidate.value,
    sourceUpdatedAt: normalizeDate(
      String(getRecordValue(rawListing.rawPayload, "updatedAt") ?? ""),
    ).value,
    scrapedAt: rawListing.fetchedAt,
    contactName: rawListing.contactName?.trim() || null,
    contactPhone: phoneCandidate.value,
    rawAttributes,
    rawPayload: rawListing.rawPayload,
    photos,
    warnings,
    conflicts,
    provenance,
  };
}
