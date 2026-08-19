export interface ListingLocation {
  readonly city: string;
  readonly district: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function resolveReference(payload: readonly unknown[], value: unknown): unknown {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    return value;
  }

  return payload[value] ?? value;
}

function readAddressLocation(
  payload: readonly unknown[],
  addressValue: unknown,
): ListingLocation | null {
  const address = resolveReference(payload, addressValue);

  if (!isRecord(address)) {
    return null;
  }

  const location = resolveReference(payload, address.location);

  if (!Array.isArray(location)) {
    return null;
  }

  // The location array is [voivodeship, city, district, ...]; only city is
  // required, district is a bonus when the source provides one.
  const city = resolveReference(payload, location[1]);
  const district = resolveReference(payload, location[2]);

  if (typeof city !== "string" || city.trim().length === 0) {
    return null;
  }

  return {
    city,
    district: typeof district === "string" && district.trim().length > 0 ? district : null,
  };
}

/**
 * Morizon stopped server-rendering the location text into visible HTML
 * (`.page-details__location-row` is now empty), so the listing's own
 * address has to be read out of the embedded Nuxt payload instead - same
 * devalue-style flat reference array as `extractSelectedMarketplaceCoordinatesFromPayload`.
 * The listing's own address object is identified by having both
 * `countryCode` and `location` keys, which advertiser/agency address
 * objects elsewhere in the payload don't have.
 */
export function extractSelectedMarketplaceLocationFromPayload(
  payloadText: string,
): ListingLocation | null {
  if (payloadText.trim().length === 0) {
    return null;
  }

  try {
    const payload: unknown = JSON.parse(payloadText);

    if (!Array.isArray(payload)) {
      return null;
    }

    for (const value of payload) {
      if (!isRecord(value) || !("countryCode" in value) || !("location" in value)) {
        continue;
      }

      const location = readAddressLocation(payload, value);

      if (location !== null) {
        return location;
      }
    }
  } catch {
    return null;
  }

  return null;
}
