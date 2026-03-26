import { getDb } from '../../db/database'

interface SlotRow {
  day_of_week: number
  hour: number
  available: number
}

interface EventRow {
  timestamp: string
}

// ─── Friend availability ──────────────────────────────────────────────────────

/**
 * Return the fraction (0–1) of friendIds who are marked available
 * at the given day-of-week + hour slot.
 */
export function getFriendAvailability(
  friendIds: string[],
  timeSlot: { dayOfWeek: number; hour: number }
): number {
  if (friendIds.length === 0) return 0

  const db = getDb()
  const placeholders = friendIds.map(() => '?').join(',')

  const rows = db.prepare(`
    SELECT user_id, available FROM availability_slots
    WHERE user_id IN (${placeholders})
      AND day_of_week = ?
      AND hour = ?
  `).all(...friendIds, timeSlot.dayOfWeek, timeSlot.hour) as Array<{ user_id: string; available: number }>

  // Friends with no row default to "available"
  const availableSet = new Map(rows.map(r => [r.user_id, r.available === 1]))
  let availableCount = 0
  for (const fid of friendIds) {
    if (availableSet.get(fid) !== false) availableCount++
  }

  return availableCount / friendIds.length
}

// ─── User's preferred time slots ─────────────────────────────────────────────

/**
 * Derive the user's preferred slots from their engagement event timestamps.
 * Returns the top 10 (dayOfWeek, hour) pairs scored 0–1.
 */
export function getPreferredSlots(
  userId: string
): Array<{ dayOfWeek: number; hour: number; score: number }> {
  const db = getDb()

  const events = db.prepare(`
    SELECT timestamp FROM engagement_events WHERE user_id = ?
  `).all(userId) as EventRow[]

  if (events.length === 0) return []

  // Count events per (dayOfWeek, hour)
  const counts = new Map<string, number>()
  for (const e of events) {
    const d   = new Date(e.timestamp)
    const key = `${d.getDay()}_${d.getHours()}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  const maxCount = Math.max(...counts.values(), 1)

  return [...counts.entries()]
    .map(([key, cnt]) => {
      const [day, hour] = key.split('_').map(Number)
      return { dayOfWeek: day, hour, score: cnt / maxCount }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
}
