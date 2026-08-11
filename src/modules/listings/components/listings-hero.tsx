import Link from "next/link";
import type { ReactElement } from "react";

import { cityOptions } from "@/modules/listings/formatters";
import { buildListingSearchHref, toggleStringListValue } from "@/modules/listings/queries";
import type { ListingSearchInput } from "@/modules/listings/types";

interface ListingsHeroProps {
  readonly filters: ListingSearchInput;
  readonly naturalQuery?: string;
}

export function ListingsHero({ filters, naturalQuery }: ListingsHeroProps): ReactElement {
  return (
    <section className="listings-hero">
      <div className="listings-hero__content">
        <h1 className="listings-hero__title">Znajdź mieszkanie, w którym zamieszkasz</h1>
        <p className="listings-hero__subtitle">
          Przeglądaj sprawdzone oferty sprzedaży i wynajmu w czterech największych miastach.
        </p>

        <form className="listings-hero__search" action="/api/listings/natural-search" method="get">

          <div
            aria-label="Typ transakcji"
            className="segmented-control listings-hero__transaction"
            role="radiogroup"
          >
            {[
              { label: "Wszystkie", value: "" },
              { label: "Sprzedaż", value: "SALE" },
              { label: "Wynajem", value: "RENT" },
            ].map((option) => (
              <Link
                aria-pressed={(filters.transactionType ?? "") === option.value}
                className="segmented-control__option"
                href={buildListingSearchHref({
                  ...filters,
                  transactionType:
                    option.value === "" ? undefined : (option.value as "SALE" | "RENT"),
                  page: 1,
                })}
                key={option.label}
              >
                <span>{option.label}</span>
              </Link>
            ))}
          </div>

          <label className="listings-hero__search-field">
            <span className="sr-only">Szukaj ofert</span>
            <input
              defaultValue={naturalQuery ?? ""}
              maxLength={500}
              name="query"
              placeholder="Np. Chcę wynająć mieszkanie w Krakowie, około 30 m², z balkonem"
              type="search"
            />
          </label>

          <button className="button-link button-link--primary listings-hero__submit" type="submit">
            Szukaj
          </button>

          <div aria-label="Miasta" className="listings-hero__cities" role="group">
            {cityOptions.map((city) => (
              <Link
                aria-pressed={filters.city?.includes(city) ?? false}
                className="city-chip"
                href={buildListingSearchHref({
                  ...filters,
                  city: toggleStringListValue(filters.city, city),
                  page: 1,
                })}
                key={city}
              >
                <span>{city}</span>
              </Link>
            ))}
          </div>
        </form>
      </div>
    </section>
  );
}
