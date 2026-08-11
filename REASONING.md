# Prodomy - Technical Reasoning

Before starting, I looked at several popular property websites to understand what makes searching for a flat easy. I combined the most useful ideas from different websites to build a clean MVP. 

## What data I extracted and why
I extracted the information that I would personally need when comparing properties:
- sale or rental type;
- price, administrative fee, deposit and other costs;
- area, number of rooms, floor and total number of floors;
- city, district, street and coordinates when available;
- photos;
- contact name and telephone number;
- building information and useful features such as a balcony, lift, parking, garage or air conditioning;
- the original title, description, source URL and publication dates.
These fields support both searching and the offer page. I kept the original source data for traceability, but standardized what the user sees. For example, inconsistent marketing titles are displayed as `3 pokoje · 67 m² · Kraków · Czyżyny`. Important factual phrases such as `Klimatyzacja`, `Bez prowizji`, `Loft` or `Kamienica` are shown as short tags instead of leaving all useful information inside a long description.
Gemini also extracts the main information from the description into a short summary. The summary separates the main price, additional costs, key points and a concise description. 

## Crawling approach
I selected one marketplace, Morizon.pl, because it had enough public sale and rental offers in Kraków, Warszawa, Wrocław and Gdańsk.
The importer runs as a separate command. It uses Crawlee with CheerioCrawler because the useful content is available in the returned HTML and embedded Nuxt data. A full browser crawler was therefore unnecessary and would have been slower and more complicated. The crawler uses limited concurrency and retries, and one failed offer does not stop the complete import.
The source adapter contains all Morizon-specific selectors. It reads normal page sections as well as embedded data for information such as coordinates, telephone numbers and complete photo galleries. This keeps marketplace-specific code separate from normalization and application code.

## Handling messy or low-quality data
External listings are inconsistent, so I first preserve the raw values and then create normalized values for the application. This means the platform can clean and standardize an offer without losing what was originally published.
- Prices and areas are converted into consistent numbers.
- Polish floor, room and location formats are normalized.
- Noisy descriptions are cleaned by removing unnecessary HTML and normalizing spacing, while the original text is retained for traceability.
- Missing optional information is stored as missing instead of inventing a value.
- Offers without a valid price, area, city, title or usable photo are not published.
- Suspicious offers can be marked for review rather than silently discarded.
I treated duplicates as another data-quality problem. Exact duplicates are detected using the source ID, canonical URL or content hash. Probable duplicates receive a score based on matching location, area, rooms, price, contact number, and floor. When offers belong to one duplicate group, the freshest and most complete version becomes the primary result.

## Data model
The main `Listing` record stores fields that are important for searching, such as transaction type, price, area, rooms and location. Photos and reusable features are stored in related tables because one listing can have many of them. Import runs, failures, validation issues and duplicate groups are also stored, which makes the ingestion process observable rather than hiding failed data.
The application uses MySQL with Prisma. Zod validates external input, search parameters, scraped-data boundaries and Gemini responses before they are used.

## AI integration - used AI in two different ways.
During development, this was my first web-scraping project, so I used AI to research possible approaches, plan the work and help with implementing it. I did not accept the output blindly, asked follow-up questions and tested results. 
Inside the product, Gemini adds value in two focused places:
- It converts a natural request such as `chcę wynająć mieszkanie w Krakowie z balkonem` into validated filters: rent, Kraków and balcony. Then MySQL searches the real stored listings. If Gemini is unavailable or returns invalid data, normal filters and listing pages still work.
- It creates a short, structured summary of a listing description and highlights important costs.


## Search strategy - two search methods:
- Regular search uses transaction type, city, price, area, rooms, features, sorting and pagination. Text search checks the title, cleaned description and location fields. The user selects filters or enters text. These values are stored in the URL, validated with Zod, and converted into a Prisma query.
- Natural-language search uses Gemini to translate a sentence into the same structured filters, after which the database performs the real search.
Filters are kept in the URL, so results can be refreshed or shared without losing the current search.

## Assumption, success metric and limitation
**Key assumption:** users are interested only in active, usable offers. For this reason, I removed the user-facing active/inactive choice and always return published primary listings.
**Success metric:** a user can quickly find a relevant real offer using either normal filters or a natural-language description, understand its essential costs and details, and open the full offer page without confusion.
**Main failure mode:** the crawler depends on Morizon's HTML and embedded Nuxt structure. If the marketplace changes its page structure, some fields may stop being extracted until the adapter is updated. Gemini is also an external dependency, although the core search does not depend on it.

## Tradeoffs and future improvements
I prioritized correctness, readable boundaries and demonstrable user value over advanced optimization. Search uses MySQL conditions and normal pagination rather than Elasticsearch, a vector database or a caching layer. I also used one marketplace instead of building a generic multi-source system. I did not perform extensive load testing or performance profiling because the dataset is approximately 100 public offers.

With more time, I would:
- open an offer when its main picture is clicked;
- replace the long photo grid with a paginated carousel or gallery viewer;
- add a recognizable logo and refine the visual identity;
- preserve more formatting from the original description while keeping it safe and readable;
- add automated monitoring for marketplace selector changes;
- improve search relevance and make subjective words such as `nice` or `cheap` relative to the available market;
- add broader performance and end-to-end tests.

## Example user journeys

**Example A - regular search:** A user selects rental offers in Kraków, enters an area between 40 and 50 m² and chooses a price from 2600. The page returns matching active offers with consistent titles, prices and photos. The user opens one result and sees its costs, gallery, details, contact information and location.

**Example B - natural-language search:** A user enters `chce wynająć mieszkanie w Gdańsku z balkonem do 3500 zł 40m`. Gemini translates the sentence into rent, Gdańsk, approximate size, price constraint and balcony filters. The database returns real matching offers, and the user can further adjust the normal filters if needed.