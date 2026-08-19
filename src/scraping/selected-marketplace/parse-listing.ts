import { createHash } from "node:crypto";

import type { ParsedMarketplaceListing } from "@/scraping/types";
import type { MarketplaceParseContext } from "@/scraping/types";
import { createExtractionWarning } from "@/scraping/types";
import { extractSelectedMarketplaceCoordinatesFromPayload } from "@/scraping/selected-marketplace/coordinates";
import { extractSelectedMarketplaceLocationFromPayload } from "@/scraping/selected-marketplace/location";

type LoadedCheerio = ReturnType<typeof import("cheerio").load>;
type CheerioElement = Parameters<LoadedCheerio>[0];

function getText(value: string | undefined): string | null {
  if (value === undefined) {
    return null;
  }

  const normalized = value.replace(/\s+/g, " ").trim();

  return normalized.length > 0 ? normalized : null;
}

function collectHighlightedParameters(
  context: MarketplaceParseContext,
): Record<string, string> {
  const $ = context.$ as LoadedCheerio;
  const attributes: Record<string, string> = {};

  $(".details-highlighted-parameters__item").each((_: number, element: CheerioElement) => {
    const label = getText(
      $(element).find(".details-highlighted-parameters__item-label").text(),
    );
    const value = getText(
      $(element).find(".details-highlighted-parameters__item-value").text(),
    );

    if (label !== null && value !== null) {
      attributes[label] = value;
    }
  });

  return attributes;
}

function collectInformationTables(
  context: MarketplaceParseContext,
): Record<string, string> {
  const $ = context.$ as LoadedCheerio;
  const attributes: Record<string, string> = {};

  $(".information-table").each((_: number, table: CheerioElement) => {
    const header = getText($(table).find(".information-table__header").first().text());

    $(table)
      .find(".information-table__row")
      .each((__: number, row: CheerioElement) => {
        const label = getText($(row).find("[data-cy='informationTableLabel']").text());
        const value = getText($(row).find("[data-cy='itemValue']").text());

        if (label === null || value === null) {
          return;
        }

        attributes[label] = value;

        if (header !== null) {
          attributes[`${header}: ${label}`] = value;
        }
      });
  });

  return attributes;
}

function collectFeatureLists(
  context: MarketplaceParseContext,
): Record<string, string[]> {
  const $ = context.$ as LoadedCheerio;
  const sections: Record<string, string[]> = {};

  $(".attribute-list").each((_: number, section: CheerioElement) => {
    const header = getText($(section).find(".attribute-list__header").text());
    const values = $(section)
      .find(".attribute-list__wrapper li")
      .map((__: number, item: CheerioElement) => getText($(item).text()))
      .get()
      .filter((value): value is string => value !== null);

    if (header !== null && values.length > 0) {
      sections[header] = values;
    }
  });

  return sections;
}

function decodeGalleryProxyUrl(source: string): string | null {
  // The proxy URL shape is /thumb/<base64-original-url>/<transform>/<file>.
  // A free-form regex over the whole string would over-match into the next
  // path segment (`/` is itself a valid base64 character), decoding a few
  // garbage trailing bytes onto an otherwise-correct URL and breaking it.
  // Parsing the path and taking the segment right after "thumb" avoids that.
  let pathname: string;

  try {
    pathname = new URL(source).pathname;
  } catch {
    return null;
  }

  const segments = pathname.split("/").filter((segment) => segment.length > 0);
  const thumbIndex = segments.indexOf("thumb");
  const encoded = thumbIndex === -1 ? undefined : segments[thumbIndex + 1];

  if (encoded === undefined) {
    return null;
  }

  try {
    const decoded = Buffer.from(encoded, "base64").toString("utf8");

    return decoded.startsWith("https://") ? decoded : null;
  } catch {
    return null;
  }
}

function collectPhotoUrls(context: MarketplaceParseContext): string[] {
  const $ = context.$ as LoadedCheerio;
  const urls = new Set<string>();

  // Scoped to this listing's own gallery only. Scanning the whole page for
  // base64-encoded thumbnail URLs (Morizon's CDN proxy scheme) also matched
  // thumbnails from unrelated "similar listings" widgets elsewhere on the
  // page, producing hundreds of photos per listing that had nothing to do
  // with it.
  $(".details-gallery__img").each((_: number, element: CheerioElement) => {
    const src = $(element).attr("src");

    if (typeof src !== "string") {
      return;
    }

    const decoded = decodeGalleryProxyUrl(src);

    if (decoded !== null) {
      urls.add(decoded);
    }
  });

  const galleryScopes = [...urls].flatMap((url) => {
    try {
      const parsed = new URL(url);
      const separatorIndex = parsed.pathname.lastIndexOf("/");
      const directory = parsed.pathname.slice(0, separatorIndex + 1);
      const filename = parsed.pathname.slice(separatorIndex + 1);
      const assetId = filename.match(/^(\d+)_/)?.[1];

      return assetId === undefined ? [] : [{ directory, assetId }];
    } catch {
      return [];
    }
  });

  // Morizon renders only two gallery images with the gallery class. A third
  // preview occurs as another proxy URL, while the complete gallery is stored
  // as bare Base64 URLs in Nuxt data. Matching both the CDN directory and
  // asset ID keeps these scans scoped to this offer rather than recommendations.
  const encodedCandidates = new Set<string>();

  for (const match of context.html.matchAll(/\/thumb\/([A-Za-z0-9+/]+={0,2})\//g)) {
    if (match[1] !== undefined) {
      encodedCandidates.add(match[1]);
    }
  }

  const nuxtData = $("#__NUXT_DATA__").text();

  for (const match of nuxtData.matchAll(/"([A-Za-z0-9+/]{40,}={0,2})"/g)) {
    if (match[1] !== undefined) {
      encodedCandidates.add(match[1]);
    }
  }

  for (const encoded of encodedCandidates) {

    let decoded: string;

    try {
      decoded = Buffer.from(encoded, "base64").toString("utf8");
    } catch {
      continue;
    }

    try {
      const parsed = new URL(decoded);
      const isSameListing = galleryScopes.some(
        ({ directory, assetId }) =>
          parsed.pathname.startsWith(directory) &&
          parsed.pathname.slice(directory.length).startsWith(`${assetId}_`),
      );

      if (isSameListing) {
        urls.add(decoded);
      }
    } catch {
      // Ignore malformed proxy payloads at this untrusted boundary.
    }
  }

  return [...urls];
}

function formatPhoneCandidate(input: string): string | null {
  const digits = input.replace(/\D/g, "");

  if (digits.length === 9) {
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)}`;
  }

  if (digits.length === 11 && digits.startsWith("48")) {
    return `+48 ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8, 11)}`;
  }

  return null;
}

function extractMaskedPhonePrefix(value: string | null): string | null {
  if (value === null) {
    return null;
  }

  const match = value.match(/(\d[\d\s]*)\.\.\./);

  if (match === null) {
    return null;
  }

  const digits = match[1]?.replace(/\D/g, "") ?? "";

  return digits.length > 0 ? digits : null;
}

function extractNuxtPhoneCandidates(context: MarketplaceParseContext): string[] {
  const $ = context.$ as LoadedCheerio;
  const nuxtData = $("#__NUXT_DATA__").text();

  if (nuxtData.length === 0) {
    return [];
  }

  const candidates = new Set<string>();
  const phoneBlocks = Array.from(nuxtData.matchAll(/"phones":\d+/g));

  for (const block of phoneBlocks) {
    const start = Math.max(0, block.index ?? 0);
    const window = nuxtData.slice(start, start + 250);

    for (const phoneMatch of window.matchAll(/(?:\+?48[\s-]*)?\d{3}[\s-]\d{3}[\s-]\d{3}/g)) {
      const formatted = formatPhoneCandidate(phoneMatch[0]);

      if (formatted !== null) {
        candidates.add(formatted);
      }
    }
  }

  return [...candidates];
}

function collectAdvertiser(context: MarketplaceParseContext): {
  readonly contactName: string | null;
  readonly contactPhone: string | null;
  readonly details: Record<string, string | null>;
} {
  const { $ } = context;
  const root = $ as LoadedCheerio;
  const container = root(".about-company").first();

  if (container.length === 0) {
    return {
      contactName: null,
      contactPhone: null,
      details: {},
    };
  }

  const maskedPhone = getText(container.find(".about-company__phones").text());
  const phoneCandidates = extractNuxtPhoneCandidates(context);
  const maskedPrefix = extractMaskedPhonePrefix(maskedPhone);
  const contactPhone =
    (maskedPrefix === null
      ? phoneCandidates[0]
      : phoneCandidates.find((candidate) => candidate.replace(/\D/g, "").startsWith(maskedPrefix))) ??
    phoneCandidates[0] ??
    null;

  return {
    contactName: getText(container.find(".about-company__name").text()),
    contactPhone,
    details: {
      sellerName: getText(container.find(".about-company__name").text()),
      sellerType: getText(container.find(".about-company__type").text()),
      sellerAddress: getText(container.find(".about-company__address").text()),
      maskedPhone,
      extractedPhone: contactPhone,
    },
  };
}

function inferTransactionType(url: string): "SALE" | "RENT" | null {
  if (url.includes("/wynajem-") || url.includes("/do-wynajecia/")) {
    return "RENT";
  }

  if (url.includes("/sprzedaz-")) {
    return "SALE";
  }

  return null;
}

export function parseSelectedMarketplaceListing(
  context: MarketplaceParseContext,
): ParsedMarketplaceListing {
  const $ = context.$ as LoadedCheerio;
  const { url, html, fetchedAt } = context;
  const extractionWarnings = [];
  const title = getText($("h1").first().text());
  const description = $(".page-details__description").first().html() ?? null;
  const nuxtDataText = $("#__NUXT_DATA__").text();
  // Morizon no longer server-renders this row's text (the element exists in
  // some pages but is empty pre-hydration), so fall back to the same
  // address parsed out of the embedded Nuxt payload.
  const locationRowText = getText($(".page-details__location-row").first().text());
  const payloadLocation = extractSelectedMarketplaceLocationFromPayload(nuxtDataText);
  const locationText =
    locationRowText ??
    (payloadLocation === null
      ? null
      : [payloadLocation.city, payloadLocation.district].filter((part) => part !== null).join(", "));
  const priceText = getText($(".details-price__item").first().text());
  const highlightedParameters = collectHighlightedParameters(context);
  const informationTables = collectInformationTables(context);
  const featureLists = collectFeatureLists(context);
  const advertiser = collectAdvertiser(context);
  const photos = collectPhotoUrls(context);
  const sourceListingId = url.match(/(mzn\d+)/i)?.[1] ?? null;
  const transactionTypeHint = inferTransactionType(url);
  const coordinates = extractSelectedMarketplaceCoordinatesFromPayload(nuxtDataText);

  if (title === null) {
    extractionWarnings.push(
      createExtractionWarning("TITLE_MISSING", "Listing title could not be extracted."),
    );
  }

  if (priceText === null) {
    extractionWarnings.push(
      createExtractionWarning("PRICE_MISSING", "Listing price could not be extracted."),
    );
  }

  if (photos.length === 0) {
    extractionWarnings.push(
      createExtractionWarning("PHOTOS_MISSING", "Listing photo URLs could not be extracted."),
    );
  }

  const attributes: Record<string, string | string[] | null> = {
    ...highlightedParameters,
    ...informationTables,
    ...advertiser.details,
    ...featureLists,
  };
  const rawAttributes: Record<string, unknown> = {
    ...attributes,
    featureLists,
  };

  return {
    source: "SELECTED_MARKETPLACE",
    sourceUrl: url,
    sourceListingId,
    title,
    description,
    transactionTypeHint,
    locationText,
    latitude: coordinates?.latitude ?? null,
    longitude: coordinates?.longitude ?? null,
    priceText,
    attributes,
    rawAttributes,
    photos,
    contactName: advertiser.contactName,
    contactPhone: advertiser.contactPhone,
    structuredData: {
      htmlTitle: getText($("title").text()),
      locationHeading: getText($(".page-details__location-row h2").first().text()),
      latitude: coordinates?.latitude ?? null,
      longitude: coordinates?.longitude ?? null,
      hasNuxtData: $("#__NUXT_DATA__").length > 0,
    },
    rawPayload: {
      htmlTitle: getText($("title").text()),
      locationText,
      latitude: coordinates?.latitude ?? null,
      longitude: coordinates?.longitude ?? null,
      highlightedParameters,
      informationTables,
      featureLists,
      advertiser: advertiser.details,
    },
    contentHash: createHash("sha256").update(html).digest("hex"),
    fetchedAt,
    extractionWarnings,
  };
}
