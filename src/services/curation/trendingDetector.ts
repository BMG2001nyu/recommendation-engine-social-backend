import type { Venue } from '../../types'
import { getDb } from '../../db/database'
import { computeTrendingScore, rowToVenue, type RawVenueRow } from './venueScorer'

/**
 * Return the top N venues in a city ordered by freshly-computed trending score.
 * We re-compute on each call so the scores reflect the latest engagement
 * velocity without requiring a background job.
 */
export function getTopTrendingVenues(city: string, limit = 10): Venue[] {
  const db   = getDb()
  const rows = db.prepare('SELECT * FROM venues WHERE city = ?').all(city) as RawVenueRow[]

  const scored = rows.map(row => ({
    row,
    trendingScore: computeTrendingScore(row.id),
  }))

  scored.sort((a, b) => b.trendingScore - a.trendingScore)

  return scored.slice(0, limit).map(({ row, trendingScore }) => {
    const venue = rowToVenue(row)
    venue.trendingScore = trendingScore
    return venue
  })
}

/**
 * Return high-quality, well-engaged venues suitable for cold-start recommendations.
 * Criteria: quality_score > 0.85 AND engagement_count > 100, sorted by quality_score desc.
 */
export function getEditorialPicks(city: string, limit = 10): Venue[] {
  const db = getDb()
  const rows = db.prepare(`
    SELECT * FROM venues
    WHERE city = ?
      AND quality_score > 0.85
      AND engagement_count > 100
    ORDER BY quality_score DESC
    LIMIT ?
  `).all(city, limit) as RawVenueRow[]

  return rows.map(rowToVenue)
}
