import type { Venue, TimeSlot } from '../../types'
import { getFriends } from '../propagation/graphTraversal'
import { getBusynessAt, sweetSpotScore } from './busynessModel'
import { getFriendAvailability, getPreferredSlots } from './availabilityModel'

// ─── Candidate slot generation ────────────────────────────────────────────────

interface CandidateSlot {
  date: Date
  dayOfWeek: number
  hour: number
}

function nextWeekendDays(fromDate: Date): Date[] {
  const results: Date[] = []
  const d = new Date(fromDate)
  d.setHours(0, 0, 0, 0)

  // Scan next 14 days for Fri (5), Sat (6)
  for (let i = 1; i <= 14 && results.length < 4; i++) {
    const candidate = new Date(d)
    candidate.setDate(d.getDate() + i)
    const dow = candidate.getDay()
    if (dow === 5 || dow === 6) results.push(candidate)
  }
  return results
}

function buildCandidates(userId: string): CandidateSlot[] {
  const now = new Date()
  const eveningHours = [18, 19, 20, 21, 22, 23]
  const candidates: CandidateSlot[] = []

  // Weekend evenings (next 2 weekends)
  for (const day of nextWeekendDays(now)) {
    for (const h of eveningHours) {
      candidates.push({ date: day, dayOfWeek: day.getDay(), hour: h })
    }
  }

  // Wed (3) / Thu (4) evenings for the next 2 weeks
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  for (let i = 1; i <= 14; i++) {
    const candidate = new Date(d)
    candidate.setDate(d.getDate() + i)
    const dow = candidate.getDay()
    if (dow === 3 || dow === 4) {
      for (const h of eveningHours) {
        candidates.push({ date: candidate, dayOfWeek: dow, hour: h })
      }
    }
  }

  return candidates
}

// ─── Score a single slot ──────────────────────────────────────────────────────

export function scoreTimeSlot(
  userId: string,
  friendIds: string[],
  venue: Venue,
  dayOfWeek: number,
  hour: number
): number {
  // Use a representative date with this day/hour
  const date = new Date()
  date.setHours(hour, 0, 0, 0)

  const friendAvailScore = getFriendAvailability(friendIds, { dayOfWeek, hour })
  const busyness         = getBusynessAt(venue, date)
  const busynessScore    = sweetSpotScore(busyness)

  const preferredSlots  = getPreferredSlots(userId)
  const matchingSlot    = preferredSlots.find(s => s.dayOfWeek === dayOfWeek && s.hour === hour)
  const habitScore      = matchingSlot?.score ?? 0

  return 0.50 * friendAvailScore + 0.30 * busynessScore + 0.20 * habitScore
}

// ─── Best time slot suggestion ────────────────────────────────────────────────

export function suggestBestTimeSlot(userId: string, venue: Venue): TimeSlot {
  const friends   = getFriends(userId)
  const friendIds = friends.map(f => f.id)
  const candidates = buildCandidates(userId)

  // Default fallback: next Friday at 20:00
  const fallbackDate = nextWeekendDays(new Date()).find(d => d.getDay() === 5) ?? new Date()
  fallbackDate.setHours(20, 0, 0, 0)

  if (candidates.length === 0) {
    return buildTimeSlot(fallbackDate, 20, 0, 0, 0, venue, friendIds.length)
  }

  let bestSlot: CandidateSlot = candidates[0]
  let bestScore = -1

  for (const slot of candidates) {
    const score = scoreTimeSlot(userId, friendIds, venue, slot.dayOfWeek, slot.hour)
    if (score > bestScore) {
      bestScore = score
      bestSlot  = slot
    }
  }

  const friendAvailScore = getFriendAvailability(friendIds, {
    dayOfWeek: bestSlot.dayOfWeek,
    hour: bestSlot.hour,
  })
  const busynessLevel = getBusynessAt(venue, bestSlot.date)
  const availableFriendCount = Math.round(friendAvailScore * friendIds.length)

  return buildTimeSlot(
    bestSlot.date,
    bestSlot.hour,
    bestScore,
    busynessLevel,
    availableFriendCount,
    venue,
    friendIds.length,
  )
}

function buildTimeSlot(
  date: Date,
  hour: number,
  confidence: number,
  busynessLevel: number,
  availableFriendCount: number,
  venue: Venue,
  totalFriends: number,
): TimeSlot {
  const start = new Date(date)
  start.setHours(hour, 0, 0, 0)
  const end = new Date(start)
  end.setHours(hour + 2)

  const dowNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const dayName  = dowNames[start.getDay()]

  const reasoning =
    `${dayName} at ${hour}:00 — ${venue.name} is at ${busynessLevel}% capacity ` +
    `(sweet spot: ~60%). ${availableFriendCount} of your ${totalFriends} friends are available.`

  return {
    startTime:            start.toISOString(),
    endTime:              end.toISOString(),
    confidence:           Math.min(1, Math.max(0, confidence)),
    reasoning,
    availableFriendCount,
    busynessLevel,
  }
}
