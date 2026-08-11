"use client";

import { useState } from "react";
import type { ReactElement } from "react";

import type { ListingPhoto } from "@/modules/listings/types";

interface ListingGalleryProps {
  readonly photos: ListingPhoto[];
  readonly title: string;
}

export function ListingGallery({ photos, title }: ListingGalleryProps): ReactElement {
  const [activeIndex, setActiveIndex] = useState(0);
  const activePhoto = photos[activeIndex] ?? photos[0];

  if (activePhoto === undefined) {
    return (
      <section className="panel">
        <h2>Galeria</h2>
        <div className="gallery gallery--empty">Brak zdjęć dla tej oferty.</div>
      </section>
    );
  }

  const hasMultiplePhotos = photos.length > 1;

  function showPrevious(): void {
    setActiveIndex((current) => (current === 0 ? photos.length - 1 : current - 1));
  }

  function showNext(): void {
    setActiveIndex((current) => (current === photos.length - 1 ? 0 : current + 1));
  }

  return (
    <section className="panel">
      <h2>Galeria</h2>
      <div className="carousel">
        <div className="carousel__stage">
          {hasMultiplePhotos ? (
            <button
              aria-label="Poprzednie zdjęcie"
              className="carousel__control carousel__control--prev"
              onClick={showPrevious}
              type="button"
            >
              ‹
            </button>
          ) : null}

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt={`${title} - zdjęcie ${activeIndex + 1}`}
            className="carousel__image"
            key={activePhoto.url}
            src={activePhoto.url}
          />

          {hasMultiplePhotos ? (
            <button
              aria-label="Następne zdjęcie"
              className="carousel__control carousel__control--next"
              onClick={showNext}
              type="button"
            >
              ›
            </button>
          ) : null}

          {hasMultiplePhotos ? (
            <span className="carousel__counter">
              {activeIndex + 1} / {photos.length}
            </span>
          ) : null}
        </div>

        {hasMultiplePhotos ? (
          <div aria-label="Miniatury zdjęć" className="carousel__thumbs" role="tablist">
            {photos.map((photo, index) => (
              <button
                aria-current={index === activeIndex}
                aria-label={`Pokaż zdjęcie ${index + 1}`}
                className={`carousel__thumb${index === activeIndex ? " carousel__thumb--active" : ""}`}
                key={`${photo.url}-${photo.position}`}
                onClick={() => setActiveIndex(index)}
                type="button"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img alt="" className="carousel__thumb-image" src={photo.url} />
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
