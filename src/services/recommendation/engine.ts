import type {
  Recommendation,
  SocialProof,
  ColdStartStrategy,
  Venue,
  InterestLevel,
} from '../../types'
import { getDb } from '../../db/database'
import { rowToVenue, type RawVenueRow } from '../curation/venueScorer'
import { getTopTrendingVenues, getEditorialPicks } from '../curation/trendingDetector'
import { buildInterestProfile } from './interestProfile'
import { scoreVenueForUser } from './venueUserMatcher'
import { suggestPeopleForVenue } from './peopleMatch'
import { suggestBestTimeSlot } from '../temporal/timeOptimizer'
import { getFriends } from '../propagation/graphTraversal'

// ─── DB row shapes ────────────────────────────────────────────────────────────

interface UserRow {
  id: string
  city: string
}

interface EngagementRow {
  venue_id: string
  level: InterestLevel
}

interface SignalRow {
  venue_id: string
  signal_strength: number
}

interface EngagementCountRow {
  level: InterestLevel
  cnt: number
}

interface FriendEngRow {
  user_id: string
  name: string
  level: InterestLevel
}

// ─── Cold-start detection ─────────────────────────────────────────────────────

export function detectColdStart(
  userId: string
): { isColdStart: boolean; isHybrid: boolean; engagementCount: number } {
  const db = getDb()
  const row = db.prepare(`
    SELECT COUNT(DISTINCT id) as cnt FROM engagement_events WHERE user_id = ?
  `).get(userId) as { cnt: number }
  const count = row?.cnt ?? 0
  return {
    isColdStart: count === 0,
    isHybrid:    count > 0 && count < 5,
    engagementCount: count,
  }
}

// ─── Social proof ─────────────────────────────────────────────────────────────

export function getSocialProofForVenue(venueId: string, userId: string): SocialProof {
  const db = getDb()

  // Counts by level
  const levelRows = db.prepare(`
    SELECT level, COUNT(*) as cnt FROM venue_engagements WHERE venue_id = ? GROUP BY level
  `).all(venueId) as EngagementCountRow[]

  const byLevel: Record<string, number> = {}
  for (const r of levelRows) byLevel[r.level] = r.cnt

  const interestedCount = byLevel['interested'] ?? 0
  const planningCount   = (byLevel['planning'] ?? 0) + (byLevel['confirmed'] ?? 0)
  const confirmedCount  = byLevel['confirmed'] ?? 0
  const total           = Object.values(byLevel).reduce((a, b) => a + b, 0)

  // Friends who have engaged
  const friends = getFriends(userId)
  const friendIds = friends.map(f => f.id)

  const friendsInterested: Array<{ userId: string; name: string }> = []
  const friendsConfirmed:  Array<{ userId: string; name: string }> = []

  if (friendIds.length > 0) {
    const placeholders = friendIds.map(() => '?').join(',')
    const friendEngRows = db.prepare(`
      SELECT ve.user_id, u.name, ve.level
      FROM venue_engagements ve
      JOIN users u ON u.id = ve.user_id
      WHERE ve.venue_id = ? AND ve.user_id IN (${placeholders})
    `).all(venueId, ...friendIds) as FriendEngRow[]

    for (const row of friendEngRows) {
      if (row.level === 'interested' || row.level === 'planning') {
        friendsInterested.push({ userId: row.user_id, name: row.name })
      }
      if (row.level === 'confirmed' || row.level === 'attended') {
        friendsConfirmed.push({ userId: row.user_id, name: row.name })
      }
    }
  }

  let momentumTrend: SocialProof['momentumTrend'] = 'cold'
  if (total > 10) momentumTrend = 'peaking'
  else if (total >= 4) momentumTrend = 'hot'
  else if (total >= 1) momentumTrend = 'warming'

  return {
    interestedCount,
    planningCount,
    confirmedCount,
    friendsInterested,
    friendsConfirmed,
    momentumTrend,
  }
}

// ─── Core feed generation ─────────────────────────────────────────────────────

export async function generateFeed(userId: string, limit = 10): Promise<Recommendation[]> {
  const db = getDb()

  const { isColdStart, engagementCount } = detectColdStart(userId)

  const userRow = db.prepare('SELECT id, city FROM users WHERE id = ?').get(userId) as UserRow | undefined
  const city = userRow?.city ?? 'New York'

  // Attended venues to exclude
  const attendedRows = db.prepare(`
    SELECT venue_id FROM venue_engagements WHERE user_id = ? AND level = 'attended'
  `).all(userId) as EngagementRow[]
  const attendedIds = new Set(attendedRows.map(r => r.venue_id))

  // ── Candidate generation ────────────────────────────────────────────────────
  let candidates: Venue[] = []

  if (engagementCount === 0) {
    // Pure cold start: editorial + trending
    const editorial = getEditorialPicks(city, 20)
    const trending  = getTopTrendingVenues(city, 20)
    candidates = deduplicateVenues([...editorial, ...trending])
  } else if (engagementCount < 5) {
    // Hybrid: 70% trending + 30% personalized
    const trending = getTopTrendingVenues(city, 30)
    const allRows  = db.prepare('SELECT * FROM venues WHERE city = ?').all(city) as RawVenueRow[]
    const allVenues = allRows.map(rowToVenue)
    candidates = deduplicateVenues([...trending, ...allVenues])
  } else {
    // Fully personalized
    const allRows = db.prepare('SELECT * FROM venues WHERE city = ?').all(city) as RawVenueRow[]
    candidates = allRows.map(rowToVenue)
  }

  // Exclude attended
  candidates = candidates.filter(v => !attendedIds.has(v.id))

  // ── Scoring ─────────────────────────────────────────────────────────────────
  const profile = isColdStart ? null : buildInterestProfile(userId)

  // Propagation signals for this user
  const now = new Date().toISOString()
  const signalRows = db.prepare(`
    SELECT venue_id, SUM(signal_strength) as signal_strength
    FROM propagation_signals
    WHERE target_user_id = ? AND consumed = 0 AND expires_at > ?
    GROUP BY venue_id
  `).all(userId, now) as SignalRow[]
  const signalMap = new Map(signalRows.map(r => [r.venue_id, r.signal_strength]))

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString()

  const scored = candidates.map(venue => {
    const venueMatch    = profile ? scoreVenueForUser(venue, profile) : venue.trendingScore
    const socialScore   = Math.min(1, signalMap.get(venue.id) ?? 0)
    const timeSlot      = suggestBestTimeSlot(userId, venue)
    const temporalScore = timeSlot.confidence
    const freshnessBonus = venue.createdAt >= thirtyDaysAgo ? 0.1 : 0
    const overall =
      0.40 * venueMatch +
      0.30 * socialScore +
      0.25 * temporalScore +
      0.05 * freshnessBonus

    return { venue, venueMatch, socialScore, temporalScore, freshnessBonus, overall, timeSlot }
  })

  scored.sort((a, b) => b.overall - a.overall)

  // Diversity pass: cap any single category at 2 entries in the top results
  const categoryCounts = new Map<string, number>()
  const top: typeof scored = []
  for (const item of scored) {
    if (top.length >= limit) break
    const cat = item.venue.category
    const count = categoryCounts.get(cat) ?? 0
    if (count >= 2) continue
    categoryCounts.set(cat, count + 1)
    top.push(item)
  }

  // ── Build recommendations ───────────────────────────────────────────────────
  let strategy: 'personalized' | 'cold_start' | 'hybrid' = 'personalized'
  if (engagementCount === 0) strategy = 'cold_start'
  else if (engagementCount < 5) strategy = 'hybrid'

  return top.map(({ venue, venueMatch, socialScore, temporalScore, freshnessBonus, overall, timeSlot }) => {
    const suggestedPeople = suggestPeopleForVenue(userId, venue, 3)
    const socialProof     = getSocialProofForVenue(venue.id, userId)

    let coldStartStrategy: ColdStartStrategy | undefined
    if (strategy === 'cold_start') {
      coldStartStrategy = {
        approach:    'trending',
        confidence:  venue.trendingScore,
        explanation: 'Recommended based on trending activity in your city.',
      }
    } else if (strategy === 'hybrid') {
      coldStartStrategy = {
        approach:    'predicted_social',
        confidence:  0.6,
        explanation: 'Blended personalisation with trending signals.',
      }
    }

    return {
      venue,
      suggestedPeople,
      suggestedTime: timeSlot,
      score: {
        venueMatch,
        socialScore,
        temporalScore,
        freshnessBonus,
        overall,
      },
      socialProof,
      coldStartStrategy,
    } satisfies Recommendation
  })
}

// ─── Deduplication helper ─────────────────────────────────────────────────────

function deduplicateVenues(venues: Venue[]): Venue[] {
  const seen = new Set<string>()
  return venues.filter(v => {
    if (seen.has(v.id)) return false
    seen.add(v.id)
    return true
  })
}
