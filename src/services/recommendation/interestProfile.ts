import type { InterestProfile, WeightedInterest, BehaviorSignals } from '../../types'
import { getDb } from '../../db/database'

// ─── DB row shapes ────────────────────────────────────────────────────────────

interface InterestRow {
  id: string
  user_id: string
  category: string
  weight: number
  source: string
  engagement_count: number
  created_at: string
}

interface EventRow {
  event_type: string
  venue_id: string | null
  timestamp: string
}

interface VenuePriceRow {
  price_level: number
}

// ─── Distinctiveness (IDF-style) ──────────────────────────────────────────────

/**
 * For each interest category across all users, compute an IDF-style
 * distinctiveness score.
 *
 * distinctiveness(c) = log(1 + totalUsers / max(1, usersWithCategory(c)))
 * Normalised so the maximum value becomes 1.
 */
export function getDistinctivenessMap(allUserIds: string[]): Record<string, number> {
  const db = getDb()
  const totalUsers = allUserIds.length

  if (totalUsers === 0) return {}

  const rows = db.prepare(`
    SELECT category, COUNT(DISTINCT user_id) as cnt
    FROM interests
    GROUP BY category
  `).all() as Array<{ category: string; cnt: number }>

  const raw: Record<string, number> = {}
  for (const { category, cnt } of rows) {
    raw[category] = Math.log(1 + totalUsers / Math.max(1, cnt))
  }

  const maxVal = Math.max(...Object.values(raw), 1)
  const normalised: Record<string, number> = {}
  for (const [cat, val] of Object.entries(raw)) {
    normalised[cat] = val / maxVal
  }
  return normalised
}

// ─── Behavior signals ─────────────────────────────────────────────────────────

function computeBehaviorSignals(userId: string): BehaviorSignals {
  const db = getDb()

  const events = db.prepare(`
    SELECT event_type, venue_id, timestamp
    FROM engagement_events
    WHERE user_id = ?
    ORDER BY timestamp ASC
  `).all(userId) as EventRow[]

  const viewCount         = events.filter(e => e.event_type === 'venue_view').length
  const saveCount         = events.filter(e => e.event_type === 'interest_expressed').length
  const planCount         = events.filter(e => e.event_type === 'plan_created').length

  const saveRate            = saveCount / Math.max(1, viewCount)
  const planConversionRate  = planCount / Math.max(1, saveCount)

  // Day / hour preference: count events per (day, hour), pick top 3
  const dayCounts:  Record<number, number> = {}
  const hourCounts: Record<number, number> = {}
  for (const e of events) {
    const d = new Date(e.timestamp)
    const day  = d.getDay()
    const hour = d.getHours()
    dayCounts[day]   = (dayCounts[day]  ?? 0) + 1
    hourCounts[hour] = (hourCounts[hour] ?? 0) + 1
  }

  const preferredDays = Object.entries(dayCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([d]) => Number(d))

  const preferredHours = Object.entries(hourCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([h]) => Number(h))

  // Price preference: average price_level of venues the user engaged with
  const engagedVenueIds = [...new Set(
    events.filter(e => e.venue_id !== null).map(e => e.venue_id as string)
  )]

  let pricePreference = 2 // default mid-range
  if (engagedVenueIds.length > 0) {
    const placeholders = engagedVenueIds.map(() => '?').join(',')
    const priceRows = db.prepare(`
      SELECT price_level FROM venues WHERE id IN (${placeholders})
    `).all(...engagedVenueIds) as VenuePriceRow[]

    if (priceRows.length > 0) {
      pricePreference = priceRows.reduce((acc, r) => acc + r.price_level, 0) / priceRows.length
    }
  }

  return {
    avgViewDuration:     0,   // not tracked at DB level currently
    saveRate,
    shareRate:           0,   // not tracked at DB level currently
    planConversionRate,
    preferredDays,
    preferredHours,
    pricePreference,
  }
}

// ─── Profile builder ──────────────────────────────────────────────────────────

export function buildInterestProfile(userId: string): InterestProfile {
  const db = getDb()

  // Load all user IDs for distinctiveness computation
  const allUserIds = (db.prepare('SELECT id FROM users').all() as Array<{ id: string }>)
    .map(r => r.id)

  const distinctivenessMap = getDistinctivenessMap(allUserIds)

  // Load this user's interests
  const interests = db.prepare(`
    SELECT * FROM interests WHERE user_id = ?
  `).all(userId) as InterestRow[]

  // Compute finalWeight = rawWeight * distinctiveness
  const rawWeighted = interests.map(i => ({
    category:       i.category,
    rawWeight:      i.weight,
    distinctiveness: distinctivenessMap[i.category] ?? 1,
    finalWeight:    i.weight * (distinctivenessMap[i.category] ?? 1),
  }))

  // Normalise finalWeight so max = 1
  const maxFinal = Math.max(...rawWeighted.map(w => w.finalWeight), 1)
  const weightedInterests: WeightedInterest[] = rawWeighted.map(w => ({
    ...w,
    finalWeight: w.finalWeight / maxFinal,
  }))

  const behaviorSignals = computeBehaviorSignals(userId)

  return {
    userId,
    weightedInterests,
    distinctivenessMap,
    behaviorSignals,
    updatedAt: new Date().toISOString(),
  }
}
