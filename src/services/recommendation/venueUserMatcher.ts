import type { Venue, InterestProfile } from '../../types'

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
export function scoreVenueForUser(venue: Venue, profile: InterestProfile): number {
  if (profile.weightedInterests.length === 0) return 0

  const venueCategory = venue.category.toLowerCase()
  const venueTags     = new Set(venue.tags.map(t => t.toLowerCase()))

  let matchingWeights = 0
  let totalWeights    = 0

  for (const wi of profile.weightedInterests) {
    const cat = wi.category.toLowerCase()
    totalWeights += wi.finalWeight

    if (cat === venueCategory) {
      matchingWeights += wi.finalWeight
    } else if (venueTags.has(cat)) {
      matchingWeights += wi.finalWeight * 0.6
    }
  }

  return Math.min(1, matchingWeights / Math.max(1, totalWeights))
}
