import Link from "next/link";
import type { ReactElement } from "react";

import {
  formatCurrency,
  formatFloor,
  formatPriceMeta,
  formatTransactionType,
} from "@/modules/listings/formatters";
import type { PublicListingListItem } from "@/modules/listings/types";

interface ListingCardProps {
  readonly listing: PublicListingListItem;
}

export function ListingCard({ listing }: ListingCardProps): ReactElement {
  const floor = formatFloor(listing.floor);
  const meta = formatPriceMeta(listing);
  const facts = [floor, ...listing.highlights].filter(
    (value): value is string => value !== null,
  );

  return (
    <article className="listing-card">
      <Link className="listing-card__media" href={`/listings/${listing.id}`}>
        {listing.photo === null ? (
          <div className="listing-card__placeholder">Brak zdjęcia</div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt={listing.title} className="listing-card__image" src={listing.photo.url} />
        )}
        <span className={`listing-badge listing-badge--${listing.transactionType.toLowerCase()}`}>
          {formatTransactionType(listing.transactionType)}
        </span>
      </Link>
      <div className="listing-card__content">
        <div className="listing-card__headline">
          <h3>
            <Link href={`/listings/${listing.id}`}>{listing.displayTitle}</Link>
          </h3>
          <p className="listing-card__price">{formatCurrency(listing.priceAmount)}</p>
        </div>
        {facts.length > 0 ? (
          <ul className="listing-card__facts" aria-label="Najważniejsze informacje o ofercie">
            {facts.map((fact) => <li key={fact}>{fact}</li>)}
          </ul>
        ) : null}
        {meta !== null ? <p className="listing-card__submeta">{meta}</p> : null}
        <div className="listing-card__footer">
          <Link className="button-link button-link--secondary" href={`/listings/${listing.id}`}>
            Zobacz szczegóły
          </Link>
        </div>
      </div>
    </article>
  );
}
