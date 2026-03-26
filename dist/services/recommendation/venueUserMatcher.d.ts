import type { Venue, InterestProfile } from '../../types';
/**
 * Score how well a venue matches a user's interest profile.
 *
 * Algorithm:
 *   1. Build a set of the venue's category + tags (lowercase).
 *   2. For each WeightedInterest, check for a match:
 *        - Exact category match  → full finalWeight
 *        - Tag match             → 0.6 × finalWeight
 *   3. venueMatch = Σ(matchingWeights) / max(1, Σ(allWeights)), capped at 1.
 *
 * Returns a value in [0, 1].
 */
export declare function scoreVenueForUser(venue: Venue, profile: InterestProfile): number;
//# sourceMappingURL=venueUserMatcher.d.ts.map