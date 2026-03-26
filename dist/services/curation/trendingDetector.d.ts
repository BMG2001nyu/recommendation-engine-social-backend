import type { Venue } from '../../types';
/**
 * Return the top N venues in a city ordered by freshly-computed trending score.
 * We re-compute on each call so the scores reflect the latest engagement
 * velocity without requiring a background job.
 */
export declare function getTopTrendingVenues(city: string, limit?: number): Venue[];
/**
 * Return high-quality, well-engaged venues suitable for cold-start recommendations.
 * Criteria: quality_score > 0.85 AND engagement_count > 100, sorted by quality_score desc.
 */
export declare function getEditorialPicks(city: string, limit?: number): Venue[];
//# sourceMappingURL=trendingDetector.d.ts.map