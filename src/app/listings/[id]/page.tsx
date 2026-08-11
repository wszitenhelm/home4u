import Link from "next/link";
import { notFound } from "next/navigation";
import * as React from "react";

import { ListingGallery } from "@/modules/listings/components/listing-gallery";
import { ListingMap } from "@/modules/listings/components/listing-map";
import {
  formatArea,
  formatCurrency,
  formatDate,
  formatFloor,
  formatFreshness,
  formatLocation,
  formatPriceMeta,
  formatRooms,
  formatTransactionType,
  splitDescriptionIntoParagraphs,
} from "@/modules/listings/formatters";
import { getListingDetail } from "@/modules/listings/service";

interface ListingDetailPageProps {
  readonly params: Promise<{
    id: string;
  }>;
}

function DetailRow({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string | null;
}): React.JSX.Element | null {
  if (value === null) {
    return null;
  }

  return (
    <div className="detail-row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function FormattedDescription({ text }: { readonly text: string }): React.JSX.Element {
  const paragraphs = splitDescriptionIntoParagraphs(text);

  return (
    <div className="description">
      {paragraphs.map((paragraph, index) => (
        <p key={index}>{paragraph}</p>
      ))}
    </div>
  );
}

export default async function ListingDetailPage({
  params,
}: ListingDetailPageProps): Promise<React.JSX.Element> {
  const { id } = await params;
  const listing = await getListingDetail(id);

  if (listing === null) {
    notFound();
  }

  const priceMeta = formatPriceMeta(listing);
  const freshness = formatFreshness(listing);

  return (
    <main className="shell shell--wide">
      <section className="stack">
        <div className="detail-back">
          <Link className="text-link" href="/listings">
            Wróć do wyników
          </Link>
        </div>

        <section className="panel detail-hero">
          <div className="detail-hero__header">
            <div>
              <span className={`listing-badge listing-badge--${listing.transactionType.toLowerCase()}`}>
                {formatTransactionType(listing.transactionType)}
              </span>
              <h1>{listing.displayTitle}</h1>
              <p className="muted">{formatLocation(listing)}</p>
            </div>
            <div className="detail-price">
              <p>{formatCurrency(listing.priceAmount)}</p>
              {priceMeta !== null ? <span>{priceMeta}</span> : null}
            </div>
          </div>

          <dl className="detail-facts" aria-label="Podstawowe informacje o ofercie">
            <DetailRow label="Metraż" value={formatArea(listing.areaM2)} />
            <DetailRow label="Pokoje" value={formatRooms(listing.rooms)} />
            <DetailRow label="Piętro" value={formatFloor(listing.floor, listing.floorCount)} />
            <DetailRow label="Dodatkowe opłaty" value={listing.aiSummary?.additionalCosts ?? null} />
            <DetailRow label="Dostępne od" value={formatDate(listing.availableFrom)} />
            <DetailRow label="Kaucja" value={listing.depositAmount === null ? null : formatCurrency(listing.depositAmount)} />
            <DetailRow label="Czynsz adm." value={listing.administrativeFee === null ? null : formatCurrency(listing.administrativeFee)} />
          </dl>
        </section>

        <ListingGallery photos={listing.photos} title={listing.displayTitle} />

        {listing.aiSummary !== null ? (
          <section className="panel ai-summary">
            <div className="ai-summary__header">
              <h2>Podsumowanie</h2>
            </div>

            <div className="ai-summary__costs">
              <div className="ai-summary__cost">
                <span className="ai-summary__cost-label">Cena</span>
                <span className="ai-summary__cost-value">{listing.aiSummary.mainCost}</span>
              </div>
              {listing.aiSummary.additionalCosts !== null ? (
                <div className="ai-summary__cost ai-summary__cost--secondary">
                  <span className="ai-summary__cost-label">Dodatkowe opłaty</span>
                  <span className="ai-summary__cost-value">{listing.aiSummary.additionalCosts}</span>
                </div>
              ) : null}
            </div>

            <p className="ai-summary__text">{listing.aiSummary.summary}</p>

            <ul className="ai-summary__highlights">
              {listing.aiSummary.highlights.map((highlight) => (
                <li key={highlight}>{highlight}</li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="detail-grid">
          <section className="panel">
            <h2>Szczegóły nieruchomości</h2>
            <dl className="detail-list">
              <DetailRow label="Lokalizacja" value={formatLocation(listing)} />
              <DetailRow label="Typ budynku" value={listing.buildingType} />
              <DetailRow label="Rok budowy" value={listing.buildingYear?.toString() ?? null} />
              <DetailRow label="Stan" value={listing.condition} />
              <DetailRow label="Rynek" value={listing.marketType} />
              <DetailRow label="Forma własności" value={listing.ownershipType} />
              <DetailRow label="Sprzedający" value={listing.sellerType} />
              <DetailRow label="Media" value={listing.utilitiesDescription} />
            </dl>
          </section>

          <section className="panel">
            <h2>Kontakt i źródło</h2>
            <dl className="detail-list">
              <DetailRow label="Osoba / firma" value={listing.contactName} />
              <DetailRow label="Telefon" value={listing.contactPhone} />
              <DetailRow label="Opublikowano" value={formatDate(listing.publishedAt)} />
              <DetailRow label="Aktualizacja" value={formatDate(listing.updatedAt)} />
              <DetailRow label="Świeżość" value={freshness} />
            </dl>
            <div className="source-notice">
              <p>To ogłoszenie pochodzi z zewnętrznego serwisu i zostało znormalizowane na potrzeby MVP.</p>
              <a className="button-link button-link--secondary" href={listing.sourceUrl} rel="noreferrer" target="_blank">
                Zobacz oryginalne ogłoszenie
              </a>
            </div>
          </section>
        </section>

        <ListingMap
          latitude={listing.latitude}
          longitude={listing.longitude}
          title={listing.displayTitle}
        />

        {listing.aiSummary === null ? (
          <section className="panel">
            <h2>Opis</h2>
            {listing.description === null ? (
              <p className="description">Opis nie został udostępniony.</p>
            ) : (
              <FormattedDescription text={listing.description} />
            )}
          </section>
        ) : listing.description !== null ? (
          <section className="panel source-description">
            <details>
              <summary>Pokaż pełny opis źródłowy</summary>
              <FormattedDescription text={listing.description} />
            </details>
          </section>
        ) : null}
      </section>
    </main>
  );
}
