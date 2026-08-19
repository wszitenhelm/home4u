import { z } from "zod";

import {
  listingFeatureKeys,
  type ListingFeatureKey,
  type TransactionType,
} from "@/modules/listings/constants";
import type { ListingSearchInput } from "@/modules/listings/types";
import { env } from "@/shared/env";

const REQUEST_TIMEOUT_MS = 12_000;
const supportedCities = ["Kraków", "Warszawa", "Wrocław", "Gdańsk"] as const;

const naturalSearchResultSchema = z.object({
  transactionType: z.enum(["SALE", "RENT"]).nullable(),
  cities: z.array(z.enum(supportedCities)).max(supportedCities.length),
  district: z.string().trim().min(1).max(100).nullable(),
  minPrice: z.number().int().positive().nullable(),
  maxPrice: z.number().int().positive().nullable(),
  minArea: z.number().positive().nullable(),
  maxArea: z.number().positive().nullable(),
  minFloor: z.number().int().min(0).nullable(),
  maxFloor: z.number().int().min(0).nullable(),
  rooms: z.number().int().positive().max(20).nullable(),
  features: z.array(z.enum(listingFeatureKeys)).max(listingFeatureKeys.length),
  q: z.string().trim().min(1).max(100).nullable(),
});

type NaturalSearchResult = z.infer<typeof naturalSearchResultSchema>;

const emptyResult = (): NaturalSearchResult => ({
  transactionType: null,
  cities: [],
  district: null,
  minPrice: null,
  maxPrice: null,
  minArea: null,
  maxArea: null,
  minFloor: null,
  maxFloor: null,
  rooms: null,
  features: [],
  q: null,
});

function normalizeText(value: string): string {
  return value
    .toLocaleLowerCase("pl-PL")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ł/g, "l");
}

const featurePhrases: ReadonlyArray<readonly [ListingFeatureKey, RegExp]> = [
  ["BALCONY", /\b(balkon\w*|balcony)\b/],
  ["ELEVATOR", /\b(wind\w*|elevator|lift)\b/],
  ["PARKING", /\b(parking\w*|miejsce postojowe)\b/],
  ["GARAGE", /\b(garaz\w*|garage)\b/],
  ["TERRACE", /\b(taras\w*|terrace)\b/],
  ["GARDEN", /\b(ogrod\w*|garden)\b/],
  ["FURNISHED", /\b(umeblowan\w*|furnished)\b/],
  ["PET_FRIENDLY", /\b(zwierzet\w*|pet friendly|pets allowed)\b/],
  ["AIR_CONDITIONING", /\b(klimatyzac\w*|air conditioning)\b/],
  ["STORAGE_ROOM", /\b(komork\w* lokatorsk\w*|storage room)\b/],
  ["SECURITY", /\b(ochron\w*|security)\b/],
  ["GATED_PROPERTY", /\b(osiedle zamkniete|gated)\b/],
];

function parseArea(text: string): Pick<NaturalSearchResult, "minArea" | "maxArea"> {
  const range = text.match(/(\d+(?:[.,]\d+)?)\s*(?:-|do)\s*(\d+(?:[.,]\d+)?)\s*(?:m2|m\^2|m²|m\b|sqm)/);

  if (range?.[1] !== undefined && range[2] !== undefined) {
    return {
      minArea: Number(range[1].replace(",", ".")),
      maxArea: Number(range[2].replace(",", ".")),
    };
  }

  const area = text.match(/(\d+(?:[.,]\d+)?)\s*(?:m2|m\^2|m²|m\b|sqm|metrow)/);

  if (area?.[1] === undefined) {
    return { minArea: null, maxArea: null };
  }

  const value = Number(area[1].replace(",", "."));
  const prefix = text.slice(Math.max(0, (area.index ?? 0) - 18), area.index ?? 0);

  if (/\b(co najmniej|min(?:imum)?|od)\s*$/.test(prefix)) {
    return { minArea: value, maxArea: null };
  }

  if (/\b(do|maks(?:ymalnie)?|max)\s*$/.test(prefix)) {
    return { minArea: null, maxArea: value };
  }

  return { minArea: Math.max(1, value - 5), maxArea: value + 5 };
}

function parseFloor(text: string): Pick<NaturalSearchResult, "minFloor" | "maxFloor"> {
  // Ground floor never carries a digit ("parter"), so it's handled on its
  // own rather than falling through to the numeric match below.
  if (/\bparter\w*\b/.test(text)) {
    return { minFloor: 0, maxFloor: 0 };
  }

  const floor = text.match(/(\d+)\s*\.?\s*pietr\w*/);

  if (floor?.[1] === undefined) {
    return { minFloor: null, maxFloor: null };
  }

  const value = Number(floor[1]);
  const matchStart = floor.index ?? 0;
  const prefix = text.slice(Math.max(0, matchStart - 18), matchStart);
  const suffix = text.slice(matchStart + floor[0].length, matchStart + floor[0].length + 18);

  if (
    /\b(co najmniej|min(?:imum)?|od)\s*$/.test(prefix) ||
    /^\s*(lub wyzej|i wyzej|wzwyz)\b/.test(suffix)
  ) {
    return { minFloor: value, maxFloor: null };
  }

  if (
    /\b(do|maks(?:ymalnie)?|max)\s*$/.test(prefix) ||
    /^\s*(lub nizej|i nizej)\b/.test(suffix)
  ) {
    return { minFloor: null, maxFloor: value };
  }

  return { minFloor: value, maxFloor: value };
}

function parsePrice(text: string): Pick<NaturalSearchResult, "minPrice" | "maxPrice"> {
  const amountPattern = "(\\d+(?:[.,]\\d+)?)\\s*(tys(?:\\.|iecy)?)?";
  const range = text.match(
    new RegExp(`${amountPattern}\\s*(?:-|do)\\s*${amountPattern}\\s*(?:zl|zlot\\w*)`),
  );

  const toAmount = (value: string, thousands: string | undefined): number =>
    Math.round(Number(value.replace(",", ".")) * (thousands === undefined ? 1 : 1000));

  if (range?.[1] !== undefined && range[3] !== undefined) {
    return {
      minPrice: toAmount(range[1], range[2]),
      maxPrice: toAmount(range[3], range[4]),
    };
  }

  const price = text.match(new RegExp(`${amountPattern}\\s*(?:zl|zlot\\w*)`));

  if (price?.[1] === undefined) {
    return { minPrice: null, maxPrice: null };
  }

  const value = toAmount(price[1], price[2]);
  const prefix = text.slice(Math.max(0, (price.index ?? 0) - 18), price.index ?? 0);

  if (/\b(co najmniej|min(?:imum)?|od)\s*$/.test(prefix)) {
    return { minPrice: value, maxPrice: null };
  }

  return { minPrice: null, maxPrice: value };
}

export function parseNaturalSearchLocally(query: string): NaturalSearchResult {
  const text = normalizeText(query);
  const result = emptyResult();

  if (/\b(wynaj\w*|do wynajecia|rent(?:al)?)\b/.test(text)) {
    result.transactionType = "RENT";
  } else if (/\b(sprzed\w*|kup\w*|sale|buy)\b/.test(text)) {
    result.transactionType = "SALE";
  }

  const cityMatchers: ReadonlyArray<readonly [(typeof supportedCities)[number], RegExp]> = [
    ["Kraków", /\bkrakow\w*\b/],
    ["Warszawa", /\bwarszaw\w*\b/],
    ["Wrocław", /\bwroclaw\w*\b/],
    ["Gdańsk", /\bgdansk\w*\b/],
  ];

  result.cities = cityMatchers.filter(([, matcher]) => matcher.test(text)).map(([city]) => city);
  result.features = featurePhrases
    .filter(([, matcher]) => matcher.test(text))
    .map(([feature]) => feature);
  Object.assign(result, parseArea(text));
  Object.assign(result, parsePrice(text));
  Object.assign(result, parseFloor(text));

  const rooms = text.match(/\b(\d+)\s*(?:pokoj\w*|rooms?)\b/);
  if (rooms?.[1] !== undefined) {
    result.rooms = Number(rooms[1]);
  }

  return result;
}

function buildPrompt(query: string): string {
  return `Jesteś parserem wyszukiwania mieszkań w polskim portalu nieruchomości.
Zamień zapytanie użytkownika na WYŁĄCZNIE jeden obiekt JSON, bez markdown i komentarzy.

Dozwolone wartości:
- transactionType: "SALE", "RENT" albo null
- cities: tylko "Kraków", "Warszawa", "Wrocław", "Gdańsk"
- features: tylko ${listingFeatureKeys.map((key) => `"${key}"`).join(", ")}
- district i q: string albo null
- minPrice, maxPrice, minArea, maxArea, minFloor, maxFloor, rooms: liczba albo null

Zasady:
- "wynająć", "wynajem", "do wynajęcia" oznacza RENT; "kupić", "sprzedaż" oznacza SALE.
- Sama powierzchnia, np. "30 m2", oznacza zakres około tej wartości: minArea 25 i maxArea 35. Dla "od", "co najmniej" lub "do" ustaw jednostronną granicę.
- "parter" oznacza piętro 0 (minFloor i maxFloor równe 0). Konkretne piętro, np. "4 piętro" lub "na 4 piętrze", ustawia minFloor i maxFloor na tę samą wartość. "od X piętra", "co najmniej X piętro" lub "X piętro lub wyżej" ustawia tylko minFloor. "do X piętra" lub "maksymalnie X piętro" ustawia tylko maxFloor. Nie zgaduj piętra dla zwrotów względnych jak "ostatnie piętro".
- q zawiera wyłącznie istotną frazę, której nie da się zapisać w pozostałych polach. Ogólne słowa typu mieszkanie, lokal, oferta ustawiają q na null.
- Nie zgaduj brakujących wymagań.

Wymagany kształt:
{"transactionType":null,"cities":[],"district":null,"minPrice":null,"maxPrice":null,"minArea":null,"maxArea":null,"minFloor":null,"maxFloor":null,"rooms":null,"features":[],"q":null}

Zapytanie użytkownika:
${query}`;
}

interface GeminiResponse {
  readonly candidates?: Array<{
    readonly content?: { readonly parts?: Array<{ readonly text?: string }> };
  }>;
}

async function parseWithGemini(query: string): Promise<NaturalSearchResult | null> {
  if (env.GEMINI_API_KEY === undefined) {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": env.GEMINI_API_KEY,
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: buildPrompt(query) }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0 },
        }),
        cache: "no-store",
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      console.error("Natural listing search request failed", { status: response.status });
      return null;
    }

    const payload = (await response.json()) as GeminiResponse;
    const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("");

    if (text === undefined || text.trim().length === 0) {
      return null;
    }

    const parsed = naturalSearchResultSchema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : null;
  } catch (error) {
    console.error(
      "Natural listing search parsing failed",
      error instanceof Error ? error.message : error,
    );
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function mergeResults(
  local: NaturalSearchResult,
  ai: NaturalSearchResult | null,
): NaturalSearchResult {
  if (ai === null) {
    return local;
  }

  return {
    transactionType: local.transactionType ?? ai.transactionType,
    cities: local.cities.length > 0 ? local.cities : ai.cities,
    district: ai.district ?? local.district,
    minPrice: ai.minPrice ?? local.minPrice,
    maxPrice: ai.maxPrice ?? local.maxPrice,
    minArea: local.minArea ?? ai.minArea,
    maxArea: local.maxArea ?? ai.maxArea,
    minFloor: local.minFloor ?? ai.minFloor,
    maxFloor: local.maxFloor ?? ai.maxFloor,
    rooms: local.rooms ?? ai.rooms,
    features: [...new Set([...local.features, ...ai.features])],
    q: ai.q ?? local.q,
  };
}

export async function parseNaturalListingSearch(query: string): Promise<Partial<ListingSearchInput>> {
  const parsed = mergeResults(parseNaturalSearchLocally(query), await parseWithGemini(query));

  return {
    q: parsed.q ?? undefined,
    transactionType: (parsed.transactionType as TransactionType | null) ?? undefined,
    city: parsed.cities.length > 0 ? parsed.cities : undefined,
    district: parsed.district ?? undefined,
    minPrice: parsed.minPrice ?? undefined,
    maxPrice: parsed.maxPrice ?? undefined,
    minArea: parsed.minArea ?? undefined,
    maxArea: parsed.maxArea ?? undefined,
    minFloor: parsed.minFloor ?? undefined,
    maxFloor: parsed.maxFloor ?? undefined,
    rooms: parsed.rooms ?? undefined,
    features: parsed.features.length > 0 ? parsed.features : undefined,
    active: true,
    page: 1,
    pageSize: 20,
    sort: "newest",
  };
}
