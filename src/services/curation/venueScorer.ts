import type { Venue } from '../../types'
import { getDb } from '../../db/database'

// ─── Raw DB row shape (snake_case from SQLite) ───────────────────────────────

export interface RawVenueRow {
  id: string
  name: string
  category: string
  tags: string            // JSON
  lat: number
  lng: number
  address: string
  city: string
  rating: number
  price_level: number
  busyness_pattern: string // JSON
  photos: string          // JSON
  vibe_description: string | null
  quality_score: number
  trending_score: number
  engagement_count: number
  created_at: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseTags(raw: string): string[] {
  try { return JSON.parse(raw) as string[] } catch { return [] }
}

function parsePhotos(raw: string): string[] {
  try { return JSON.parse(raw) as string[] } catch { return [] }
}

// ─── Quality Score ────────────────────────────────────────────────────────────

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
export function computeQualityScore(venue: RawVenueRow): number {
  const normalizedRating = (venue.rating - 1) / 4

  const photos = parsePhotos(venue.photos)
  const tags   = parseTags(venue.tags)
  const hasVibe = venue.vibe_description && venue.vibe_description.trim().length > 0 ? 1 : 0
  const contentRichness = Math.min(
    hasVibe * 0.3 + Math.min(photos.length / 5, 1) * 0.4 + Math.min(tags.length / 8, 1) * 0.3,
    1
  )

  const engagementFactor = Math.min(
    Math.log(1 + venue.engagement_count) / Math.log(1 + 500),
    1
  )

  const priceSignal = venue.price_level / 4

  return (
    0.35 * normalizedRating +
    0.25 * contentRichness +
    0.25 * engagementFactor +
    0.15 * priceSignal
  )
}

// ─── Trending Score ───────────────────────────────────────────────────────────

/**
 * Compute a 0–1 trending signal based on engagement velocity.
 *
 * velocity = recentCount / max(1, baselineCount / (168 / windowHours))
 * trendingScore = min(1, velocity / 5)
 */
export function computeTrendingScore(venueId: string, windowHours = 48): number {
  const db = getDb()

  const nowMs = Date.now()
  const windowStart = new Date(nowMs - windowHours * 3_600_000).toISOString()
  const baselineStart = new Date(nowMs - (7 * 24 + windowHours) * 3_600_000).toISOString()

  const recentRow = db.prepare(`
    SELECT COUNT(*) as cnt
    FROM engagement_events
    WHERE venue_id = ? AND timestamp >= ?
  `).get(venueId, windowStart) as { cnt: number }

  const baselineRow = db.prepare(`
    SELECT COUNT(*) as cnt
    FROM engagement_events
    WHERE venue_id = ? AND timestamp >= ? AND timestamp < ?
  `).get(venueId, baselineStart, windowStart) as { cnt: number }

  const recentCount   = recentRow?.cnt ?? 0
  const baselineCount = baselineRow?.cnt ?? 0

  const expectedRate = baselineCount / (168 / windowHours)
  const velocity     = recentCount / Math.max(1, expectedRate)
  return Math.min(1, velocity / 5)
}

// ─── Batch Refresh ────────────────────────────────────────────────────────────

/** Recompute quality_score and trending_score for every venue and persist. */
export function refreshVenueScores(): void {
  const db = getDb()
  const rows = db.prepare('SELECT * FROM venues').all() as RawVenueRow[]

  const updateStmt = db.prepare(`
    UPDATE venues SET quality_score = ?, trending_score = ? WHERE id = ?
  `)

  const updateAll = db.transaction((venues: RawVenueRow[]) => {
    for (const v of venues) {
      const quality  = computeQualityScore(v)
      const trending = computeTrendingScore(v.id)
      updateStmt.run(quality, trending, v.id)
    }
  })

  updateAll(rows)
}

// ─── Row → Venue converter (shared across curation layer) ────────────────────

export function rowToVenue(row: RawVenueRow): Venue {
  return {
    id:              row.id,
    name:            row.name,
    category:        row.category,
    tags:            parseTags(row.tags),
    lat:             row.lat,
    lng:             row.lng,
    address:         row.address,
    city:            row.city,
    rating:          row.rating,
    priceLevel:      row.price_level as 1 | 2 | 3 | 4,
    busynessPattern: (() => { try { return JSON.parse(row.busyness_pattern) } catch { return [] } })(),
    photos:          parsePhotos(row.photos),
    vibeDescription: row.vibe_description ?? '',
    qualityScore:    row.quality_score,
    trendingScore:   row.trending_score,
    engagementCount: row.engagement_count,
    createdAt:       row.created_at,
  }
}
