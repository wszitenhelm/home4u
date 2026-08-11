import Link from "next/link";
import type { ReactElement } from "react";

import type { ListingSearchInput } from "@/modules/listings/types";

interface ListingFiltersProps {
  readonly filters: ListingSearchInput;
  readonly naturalQuery?: string;
}

export function ListingFilters({ filters, naturalQuery }: ListingFiltersProps): ReactElement {
  return (
    <form className="filters-card" action="/api/listings/natural-search" method="get">
      <input name="active" type="hidden" value="true" />
      {naturalQuery !== undefined ? (
        <input name="previousNaturalQuery" type="hidden" value={naturalQuery} />
      ) : null}
      {/* Transaction type and city are chosen in the hero above; preserve
          them here so applying the rest of these filters does not reset
          that selection. */}
      {filters.transactionType !== undefined ? (
        <input name="transactionType" type="hidden" value={filters.transactionType} />
      ) : null}
      {filters.city?.map((city) => <input key={city} name="city" type="hidden" value={city} />)}
      {filters.features?.map((feature) => (
        <input key={feature} name="features" type="hidden" value={feature} />
      ))}
      <div className="filters-card__header">
        <div>
          <p className="eyebrow">Wyszukiwanie</p>
          <h2>Filtry ofert</h2>
        </div>
        <Link className="text-link" href="/listings">
          Resetuj
        </Link>
      </div>
      <fieldset className="filters-grid">
        <legend className="sr-only">Filtry wyszukiwania ofert</legend>
        <label className="field">
          <span>Dzielnica</span>
          <input defaultValue={filters.district ?? ""} name="district" placeholder="np. Krowodrza" type="text" />
        </label>

        <label className="field">
          <span>Pokoje</span>
          <select defaultValue={filters.rooms?.toString() ?? ""} name="rooms">
            <option value="">Dowolnie</option>
            {[1, 2, 3, 4, 5].map((rooms) => (
              <option key={rooms} value={rooms}>
                {rooms}+
              </option>
            ))}
          </select>
        </label>

        <div className="field-range-group">
          <div className="field-range-row">
            <label className="field">
              <span>Cena od</span>
              <input defaultValue={filters.minPrice?.toString() ?? ""} inputMode="numeric" min="1" name="minPrice" placeholder="np. 400000" type="number" />
            </label>

            <label className="field">
              <span>Cena do</span>
              <input defaultValue={filters.maxPrice?.toString() ?? ""} inputMode="numeric" min="1" name="maxPrice" placeholder="np. 900000" type="number" />
            </label>
          </div>

          <div className="field-range-row">
            <label className="field">
              <span>Metraż od</span>
              <input defaultValue={filters.minArea?.toString() ?? ""} inputMode="decimal" min="1" name="minArea" placeholder="np. 35" step="0.1" type="number" />
            </label>

            <label className="field">
              <span>Metraż do</span>
              <input defaultValue={filters.maxArea?.toString() ?? ""} inputMode="decimal" min="1" name="maxArea" placeholder="np. 80" step="0.1" type="number" />
            </label>
          </div>
        </div>

        <label className="field">
          <span>Sortowanie</span>
          <select defaultValue={filters.sort} name="sort">
            <option value="newest">Najnowsze</option>
            <option value="price_asc">Cena rosnąco</option>
            <option value="price_desc">Cena malejąco</option>
            <option value="area_asc">Metraż rosnąco</option>
            <option value="area_desc">Metraż malejąco</option>
          </select>
        </label>
      </fieldset>

      <div className="filters-card__actions">
        <button className="button-link button-link--primary" type="submit">
          Zastosuj filtry
        </button>
      </div>
    </form>
  );
}
