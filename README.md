# Home4u

Home4u is a Smart Real Estate Listings Platform MVP for Polish apartments. It ingests listings from one public marketplace, normalizes noisy source data, keeps low-quality and duplicate outcomes observable internally, and exposes only published primary listings through a Next.js application and public API.

## Project overview

The MVP focuses on:

- apartments only
- sale and long-term rent
- PLN only
- one marketplace integration
- four target cities: Kraków, Warszawa, Wrocław, Gdańsk
- deterministic seed data when live crawling is unavailable
- public browse, search, filtering, pagination, and listing details

Excluded on purpose:

- authentication
- saved searches
- favourites
- multiple marketplaces
- Elasticsearch or vector search
- admin dashboards
- production anti-bot workarounds

## Architecture

Application flow:

```text
Marketplace
  -> Crawlee crawler
  -> selected marketplace adapter
  -> normalization
  -> quality gate
  -> deduplication
  -> MySQL / Prisma
  -> repository
  -> service
  -> Next.js pages and Route Handlers
```

Backend dependency direction:

```text
UI / Route Handlers
  -> Services
  -> Repositories
  -> Prisma
  -> MySQL
```

Important boundaries:

- Route Handlers do not query Prisma directly.
- Public pages call services directly from Server Components instead of fetching the app's own API.
- Marketplace selectors stay inside `src/scraping/selected-marketplace`.
- Normalizers do not depend on DOM or Cheerio.
- Public DTOs do not expose raw payloads, raw source attributes, ingestion warnings, or duplicate internals.

## Technology choices

- Next.js App Router for the application shell and server rendering
- React 19 for UI
- TypeScript strict mode for safety
- Prisma + MySQL for persistence
- Zod for environment variables, HTTP input, and key data boundaries
- Crawlee + CheerioCrawler for ingestion
- Vitest for unit and integration tests
- Docker Compose for local MySQL
- pnpm as the package manager

## Selected marketplace

- Source: `Morizon.pl`
- Why selected: public apartment sale and rent listings exist across the target cities with enough volume for MVP sampling.
- Useful data location: result pages, listing HTML, and embedded server-rendered Nuxt payload data.
- Crawler requirement: `CheerioCrawler` is sufficient for the implemented integration.

## Scraping limitations

- No CAPTCHA bypass, no login bypass, and no proxy rotation are implemented.
- Marketplace HTML and embedded data can change without notice.
- Phone numbers may be masked in visible HTML; the parser uses public embedded Nuxt data when available.
- Live crawling has been smoke-tested, but fixture-backed parsing is the more reproducible test path in this environment.

## AI status

AI-assisted listing summaries are implemented as an optional ingestion-time feature. When `GEMINI_API_KEY` is configured, published listings can receive a short structured summary generated from the normalized description and stored with the listing record. When the key is absent or the model response fails validation, ingestion falls back to deterministic fields only.

## Local setup

1. Copy the environment template:

```bash
cp .env.example .env
```

2. Install dependencies:

```bash
pnpm install
```

3. Start MySQL:

```bash
docker compose up -d
```

4. Generate Prisma client:

```bash
pnpm db:generate
```

5. Apply migrations:

```bash
pnpm db:migrate
```

6. Seed deterministic sample data:

```bash
pnpm db:seed
```

7. Start the app:

```bash
pnpm dev
```

8. Open:

```text
http://localhost:3000/listings
```

## Docker and MySQL startup

The local database service is defined in `docker-compose.yml`:

```bash
docker compose up -d
docker compose ps
```

Connection defaults:

- host: `127.0.0.1`
- port: `3306`
- database: `home4u`
- user: `home4u`

## Migrations

Generate Prisma client:

```bash
pnpm db:generate
```

Apply local development migration:

```bash
pnpm db:migrate
```

The legacy aliases below are also available:

```bash
pnpm prisma:generate
pnpm prisma:migrate
```

## Seed command

The seed is deterministic and reproducible:

```bash
pnpm db:seed
```

Legacy alias:

```bash
pnpm prisma:seed
```

The seeded dataset includes approximately 100 published primary listings plus a small number of rejected, needs-review, and duplicate records so public visibility rules can be verified.

## Ingestion command

Run the live ingestion CLI:

```bash
pnpm ingest
```

It runs outside HTTP requests and persists accepted, rejected, review, duplicate, and issue outcomes.

## Tests and validation

Run the main checks:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Note: `tsconfig.json` includes `.next/types/**/*.ts`, so on a clean workspace `pnpm typecheck` may require `pnpm build` first to regenerate Next.js type artifacts.

## Public application behavior

`/listings` supports:

- sale/rent filter
- text search
- city filter
- district filter
- minimum and maximum price
- minimum and maximum area
- room filter
- sort selector
- active-offers control
- reset action
- result count
- page-based pagination

All search state is stored in URL query parameters, so reloads and shared URLs restore the same search.

`/listings/[id]` shows:

- image gallery
- title and transaction badge
- price
- administrative fee for rent when known
- deposit when known
- area and rooms
- location
- floor and building data
- normalized features
- seller/contact information when available
- cleaned description
- source freshness
- original listing link
- external-source notice

## Sample user journeys

### Structured Kraków apartment search

1. Open `/listings`.
2. Select `Sprzedaż`.
3. Choose `Kraków`.
4. Set `Cena od` and `Cena do`.
5. Set `Metraż od` and `Metraż do`.
6. Optionally set `Pokoje`.
7. Sort by `Cena rosnąco` or `Najnowsze`.
8. Open a matching detail page.

### Vague intent example

Example user intent: “Szukam przytulnego mieszkania w Krakowie z balkonem, najlepiej w spokojnej okolicy.”

Current MVP behavior:

- the user can use text search plus structured filters manually
- the app does not yet translate vague intent into filters automatically
- AI assistance is explicitly unimplemented in this stage

## Observability dashboard (Grafana Cloud)

Run history and Gemini call metrics are visualized in Grafana Cloud, reading directly from the app's own MySQL/TiDB tables — no separate metrics pipeline, no data duplicated into Grafana's own storage:

- `FreshnessCheckRun` / `EmbeddingBackfillRun` — one row per scheduled script run, with a `RUNNING` → `COMPLETED` / `COMPLETED_WITH_ERRORS` / `FAILED` lifecycle and per-run counts.
- `AiCallLog` — one row per Gemini API call attempt (embeddings + natural-language search parsing), with duration, success, and whether the deterministic fallback was triggered.

Dashboard: [Job Run History](https://magentakale2863.grafana.net/d/witxcwr/job-run-history)

**Panels:**
1. **Run history** — recent `FreshnessCheckRun`/`EmbeddingBackfillRun` rows in one table, `status` color-coded (green/orange/red) so a failure is visible without reading the text.
2. **Gemini call reliability** — success rate and fallback-triggered rate over time, from `AiCallLog`.
3. **Gemini call latency** — per-call `durationMs` over time (unaveraged, so a single slow call is visible immediately rather than smoothed into a daily average).

**Setup:** Grafana Cloud free tier, MySQL data source pointed directly at the production TiDB instance (TLS required; TiDB Cloud Serverless usernames need the cluster-specific prefix shown in its own Connect panel). Since panels query TiDB live rather than ingesting metrics into Grafana Cloud's own storage, this doesn't count against the free tier's ingestion/retention limits at all.

## Known limitations

- Public text search is simple Prisma-based `contains` matching, not ranked search.
- The local dev experience can be affected if `pnpm` decides `node_modules` must be recreated while network access is unavailable.
- Live crawling depends on one marketplace’s markup and embedded data stability.
- The frontend is intentionally restrained and does not include accounts, saved state, or advanced personalization.
