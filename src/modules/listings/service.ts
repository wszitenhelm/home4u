import { cosineSimilarity, generateEmbedding } from "@/modules/listings/ai/embeddings";
import { mapListingRecordToDetail, mapListingRecordToListItem } from "@/modules/listings/mappers";
import { listingRepository } from "@/modules/listings/repository";
import type {
  ListingIndexResult,
  ListingRepository,
  ListingSearchInput,
  PublicListingDetail,
} from "@/modules/listings/types";

// Chosen empirically against the real listing set: a deliberately
// irrelevant query topped out at 0.676 similarity across all published
// listings, while genuinely relevant queries' correct matches scored
// 0.72-0.83. 0.70 sits just above that "noise ceiling" without excluding
// real matches.
const SEMANTIC_SIMILARITY_THRESHOLD = 0.7;

function calculateTotalPages(total: number, pageSize: number): number {
  return total === 0 ? 0 : Math.ceil(total / pageSize);
}

export function createListingService(repository: ListingRepository = listingRepository): {
  getListingIndex: (input: ListingSearchInput) => Promise<ListingIndexResult>;
  getListingDetail: (id: string) => Promise<PublicListingDetail | null>;
  getSemanticListingIndex: (input: ListingSearchInput) => Promise<ListingIndexResult>;
} {
  async function getListingIndex(input: ListingSearchInput): Promise<ListingIndexResult> {
    const result = await repository.findPublicListings(input);

    return {
      items: result.items.map(mapListingRecordToListItem),
      pagination: {
        page: input.page,
        pageSize: input.pageSize,
        total: result.total,
        totalPages: calculateTotalPages(result.total, input.pageSize),
      },
      appliedFilters: input,
    };
  }

  return {
    getListingIndex,
    async getListingDetail(id: string): Promise<PublicListingDetail | null> {
      const listing = await repository.findPublicListingById(id);

      if (listing === null) {
        return null;
      }

      return mapListingRecordToDetail(listing);
    },
    async getSemanticListingIndex(input: ListingSearchInput): Promise<ListingIndexResult> {
      const query = input.semanticQuery;

      if (query === undefined) {
        return getListingIndex(input);
      }

      // Deterministic fallback to plain-text search, same discipline as
      // parseNaturalListingSearch: semantic search must never break search
      // entirely just because Gemini is unconfigured or unreachable.
      const fallback = (): Promise<ListingIndexResult> =>
        getListingIndex({ ...input, q: query, semanticQuery: undefined });

      const queryEmbedding = await generateEmbedding(query, "RETRIEVAL_QUERY");

      if (queryEmbedding === null) {
        console.error("Semantic search embedding unavailable, falling back to text search.", {
          query,
        });

        return fallback();
      }

      const candidates = await repository.findPublishedListingEmbeddings(input);

      if (candidates.length === 0) {
        // Two indistinguishable causes here (no embeddings generated yet vs.
        // the current filters legitimately matching zero listings) - either
        // way the fallback below applies the same filters and correctly
        // resolves to an empty result, so it's safe not to tell them apart.
        console.error(
          "Semantic search found no candidate listings for the current filters, falling back to text search.",
          { query },
        );

        return fallback();
      }

      const ranked = candidates
        .map((candidate) => ({
          id: candidate.id,
          score: cosineSimilarity(queryEmbedding, candidate.embedding),
        }))
        .filter((candidate) => candidate.score >= SEMANTIC_SIMILARITY_THRESHOLD)
        .sort((a, b) => b.score - a.score);

      const total = ranked.length;
      const start = (input.page - 1) * input.pageSize;
      const pageIds = ranked.slice(start, start + input.pageSize).map((entry) => entry.id);
      const listings =
        pageIds.length === 0 ? [] : await repository.findPublicListingsByIds(pageIds);
      const listingsById = new Map(listings.map((listing) => [listing.id, listing]));

      return {
        // findPublicListingsByIds already preserves pageIds order, but
        // re-deriving from the map keeps this resilient if that changes.
        items: pageIds.flatMap((id) => {
          const listing = listingsById.get(id);

          return listing === undefined ? [] : [mapListingRecordToListItem(listing)];
        }),
        pagination: {
          page: input.page,
          pageSize: input.pageSize,
          total,
          totalPages: calculateTotalPages(total, input.pageSize),
        },
        appliedFilters: input,
      };
    },
  };
}

const service = createListingService();

export async function getListingIndex(input: ListingSearchInput): Promise<ListingIndexResult> {
  return service.getListingIndex(input);
}

export async function getListingDetail(id: string): Promise<PublicListingDetail | null> {
  return service.getListingDetail(id);
}

export async function getSemanticListingIndex(
  input: ListingSearchInput,
): Promise<ListingIndexResult> {
  return service.getSemanticListingIndex(input);
}
