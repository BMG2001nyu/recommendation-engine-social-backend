import type { Venue } from '../../types';
export interface RawVenueRow {
    id: string;
    name: string;
    category: string;
    tags: string;
    lat: number;
    lng: number;
    address: string;
    city: string;
    rating: number;
    price_level: number;
    busyness_pattern: string;
    photos: string;
    vibe_description: string | null;
    quality_score: number;
    trending_score: number;
    engagement_count: number;
    created_at: string;
}
/**
 * Compute a 0–1 quality signal from static venue attributes.
 *
 * Formula:
 *   normalizedRating  = (rating - 1) / 4
 *   contentRichness   = hasVibe(0.3) + min(photoCount/5, 1)*0.4 + min(tagsCount/8, 1)*0.3
 *   engagementFactor  = log(1+engagementCount) / log(1+500), capped at 1
 *   priceSignal       = priceLevel / 4
 *   qualityScore      = 0.35*normalizedRating + 0.25*contentRichness
 *                     + 0.25*engagementFactor + 0.15*priceSignal
 */
export declare function computeQualityScore(venue: RawVenueRow): number;
/**
 * Compute a 0–1 trending signal based on engagement velocity.
 *
 * velocity = recentCount / max(1, baselineCount / (168 / windowHours))
 * trendingScore = min(1, velocity / 5)
 */
export declare function computeTrendingScore(venueId: string, windowHours?: number): number;
/** Recompute quality_score and trending_score for every venue and persist. */
export declare function refreshVenueScores(): void;
export declare function rowToVenue(row: RawVenueRow): Venue;
//# sourceMappingURL=venueScorer.d.ts.map