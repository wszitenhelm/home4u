import type {
  ListingFeature,
  ListingSearchInput,
  PublicListingDetail,
  PublicListingListItem,
} from "@/modules/listings/types";

const currencyFormatter = new Intl.NumberFormat("pl-PL", {
  style: "currency",
  currency: "PLN",
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat("pl-PL", {
  maximumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat("pl-PL", {
  dateStyle: "medium",
});

const relativeFormatter = new Intl.RelativeTimeFormat("pl-PL", {
  numeric: "auto",
});

const buildingHeightLabels: Readonly<Record<number, string>> = {
  1: "jednopiętrowym",
  2: "dwupiętrowym",
  3: "trzypiętrowym",
  4: "czteropiętrowym",
  5: "pięciopiętrowym",
  6: "sześciopiętrowym",
  7: "siedmiopiętrowym",
  8: "ośmiopiętrowym",
  9: "dziewięciopiętrowym",
  10: "dziesięciopiętrowym",
  11: "jedenastopiętrowym",
  12: "dwunastopiętrowym",
  13: "trzynastopiętrowym",
  14: "czternastopiętrowym",
  15: "piętnastopiętrowym",
  16: "szesnastopiętrowym",
  17: "siedemnastopiętrowym",
  18: "osiemnastopiętrowym",
  19: "dziewiętnastopiętrowym",
  20: "dwudziestopiętrowym",
};

const featureLabels: Record<ListingFeature["key"], string> = {
  BALCONY: "Balkon",
  ELEVATOR: "Winda",
  PARKING: "Parking",
  GARAGE: "Garaż",
  TERRACE: "Taras",
  GARDEN: "Ogród",
  FURNISHED: "Umeblowane",
  PET_FRIENDLY: "Przyjazne zwierzętom",
  AIR_CONDITIONING: "Klimatyzacja",
  STORAGE_ROOM: "Komórka lokatorska",
  SECURITY: "Ochrona",
  GATED_PROPERTY: "Osiedle zamknięte",
};

const highlightFeaturePriority: readonly ListingFeature["key"][] = [
  "AIR_CONDITIONING",
  "GARAGE",
  "PARKING",
  "BALCONY",
  "TERRACE",
  "GARDEN",
  "ELEVATOR",
  "FURNISHED",
  "STORAGE_ROOM",
  "SECURITY",
  "GATED_PROPERTY",
  "PET_FRIENDLY",
];

export const cityOptions = ["Kraków", "Warszawa", "Wrocław", "Gdańsk"] as const;

export function formatCurrency(amount: string): string {
  return currencyFormatter.format(Number(amount));
}

export function formatArea(areaM2: string): string {
  return `${numberFormatter.format(Number(areaM2))} m²`;
}

export function formatRooms(rooms: number | null): string | null {
  if (rooms === null) {
    return null;
  }

  return `${rooms} pok.`;
}

export function formatRoomsLong(rooms: number | null): string | null {
  if (rooms === null) {
    return null;
  }

  const lastTwoDigits = rooms % 100;
  const lastDigit = rooms % 10;
  const noun =
    lastTwoDigits >= 12 && lastTwoDigits <= 14
      ? "pokoi"
      : lastDigit === 1
        ? "pokój"
        : lastDigit >= 2 && lastDigit <= 4
          ? "pokoje"
          : "pokoi";

  return `${rooms} ${noun}`;
}

export function formatListingDisplayTitle(
  listing: Pick<PublicListingListItem, "areaM2" | "city" | "district" | "rooms">,
): string {
  const district =
    listing.district?.localeCompare(listing.city, "pl", { sensitivity: "base" }) === 0
      ? null
      : listing.district;

  return [
    formatRoomsLong(listing.rooms),
    formatArea(listing.areaM2),
    listing.city,
    district,
  ]
    .filter((value): value is string => value !== null)
    .join(" · ");
}

function normalizeHighlightSource(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export function deriveListingHighlights(input: {
  readonly sourceTitle: string;
  readonly buildingType: string | null;
  readonly features: readonly ListingFeature[];
  readonly limit?: number;
}): string[] {
  const sourceText = normalizeHighlightSource(
    `${input.sourceTitle} ${input.buildingType ?? ""}`,
  );
  const highlights: string[] = [];

  const add = (label: string): void => {
    if (!highlights.includes(label)) {
      highlights.push(label);
    }
  };

  for (const key of highlightFeaturePriority) {
    if (
      input.features.some(
        (feature) => feature.key === key && feature.booleanValue !== false,
      )
    ) {
      add(featureLabels[key]);
    }
  }

  if (sourceText.includes("klimatyzac")) {
    add("Klimatyzacja");
  }

  if (/bez\s+prowizj/.test(sourceText)) {
    add("Bez prowizji");
  }

  if (/\bloft\b/.test(sourceText)) {
    add("Loft");
  }

  if (sourceText.includes("kamienic")) {
    add("Kamienica");
  }

  return highlights.slice(0, input.limit ?? 2);
}

export function formatFloor(
  floor: number | null,
  floorCount?: number | null,
): string | null {
  if (floor === null) {
    return null;
  }

  const floorLabel = floor === 0 ? "Parter" : `${floor}. piętro`;

  if (floorCount !== undefined && floorCount !== null && floorCount > 0) {
    const buildingHeight = buildingHeightLabels[floorCount] ?? `${floorCount}-piętrowym`;

    return `${floorLabel} w ${buildingHeight} bloku`;
  }

  return floorLabel;
}

export function formatTransactionType(
  transactionType: PublicListingListItem["transactionType"],
): string {
  return transactionType === "SALE" ? "Na sprzedaż" : "Na wynajem";
}

export function formatSortLabel(sort: ListingSearchInput["sort"]): string {
  switch (sort) {
    case "price_asc":
      return "Cena rosnąco";
    case "price_desc":
      return "Cena malejąco";
    case "area_asc":
      return "Metraż rosnąco";
    case "area_desc":
      return "Metraż malejąco";
    case "newest":
    default:
      return "Najnowsze";
  }
}

export function formatPriceMeta(listing: PublicListingListItem): string | null {
  if (listing.transactionType === "RENT") {
    if (listing.administrativeFee !== null) {
      return `Czynsz adm. ${formatCurrency(listing.administrativeFee)}`;
    }

    return null;
  }

  if (listing.pricePerSquareMetre !== null) {
    return `${formatCurrency(listing.pricePerSquareMetre)}/m²`;
  }

  return null;
}

export function formatLocation(
  location: Pick<PublicListingListItem, "city" | "district" | "street">,
): string {
  return [location.city, location.district, location.street].filter(Boolean).join(", ");
}

export function formatDate(value: string | null): string | null {
  if (value === null) {
    return null;
  }

  return dateFormatter.format(new Date(value));
}

export function formatFreshness(detail: Pick<PublicListingDetail, "updatedAt" | "publishedAt">): string | null {
  const source = detail.updatedAt ?? detail.publishedAt;

  if (source === null) {
    return null;
  }

  const date = new Date(source);
  const now = new Date();
  const diffDays = Math.round((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  return `Źródło zaktualizowano ${relativeFormatter.format(diffDays, "day")}`;
}

export function formatFeatureValue(feature: ListingFeature): string {
  const label = featureLabels[feature.key];

  if (feature.valueType === "BOOLEAN") {
    return feature.booleanValue === false ? `${label}: nie` : label;
  }

  if (feature.valueType === "NUMBER" && feature.numberValue !== null) {
    return `${label}: ${numberFormatter.format(Number(feature.numberValue))}`;
  }

  if (feature.textValue !== null) {
    return `${label}: ${feature.textValue}`;
  }

  return feature.rawValue === null ? label : `${label}: ${feature.rawValue}`;
}

const sentenceBoundary = /(?<=[.!?])\s+(?=[A-ZĄĆĘŁŃÓŚŹŻ])/u;
const sentencesPerParagraph = 3;

export function splitDescriptionIntoParagraphs(description: string): string[] {
  return description
    .split("\n")
    .map((block) => block.trim())
    .filter((block) => block.length > 0)
    .flatMap((block) => {
      const sentences = block
        .split(sentenceBoundary)
        .map((sentence) => sentence.trim())
        .filter((sentence) => sentence.length > 0);
      const paragraphs: string[] = [];

      for (let index = 0; index < sentences.length; index += sentencesPerParagraph) {
        paragraphs.push(sentences.slice(index, index + sentencesPerParagraph).join(" "));
      }

      return paragraphs;
    });
}
