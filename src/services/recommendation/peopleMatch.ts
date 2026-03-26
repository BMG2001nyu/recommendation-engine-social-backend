import type { Venue, SuggestedPerson, InterestLevel } from '../../types'
import { getDb } from '../../db/database'
import { getFriends, getMutuals } from '../propagation/graphTraversal'
import { buildInterestProfile } from './interestProfile'
import { scoreVenueForUser } from './venueUserMatcher'
import { getFriendAvailability } from '../temporal/availabilityModel'
import { suggestBestTimeSlot } from '../temporal/timeOptimizer'

// ─── DB row shapes ────────────────────────────────────────────────────────────

interface EngagementRow {
  level: InterestLevel
}

// ─── Candidate person builder ─────────────────────────────────────────────────

interface PersonCandidate {
  userId: string
  name: string
  reason: 'friend' | 'mutual' | 'compatible'
  socialProximity: number
  sharedInterestScore: number
  venueCompatibilityScore: number
  availabilityScore: number
  hasExpressedInterest: boolean
  sharedInterests: string[]
}

function getVenueEngagementLevel(userId: string, venueId: string): InterestLevel | null {
  const db = getDb()
  const row = db.prepare(`
    SELECT level FROM venue_engagements WHERE user_id = ? AND venue_id = ?
  `).get(userId, venueId) as EngagementRow | undefined
  return row?.level ?? null
}

function computeSharedInterests(
  sourceCategories: Set<string>,
  targetCategories: Set<string>
): { score: number; shared: string[] } {
  const shared: string[] = []
  let intersection = 0
  let union = new Set([...sourceCategories, ...targetCategories]).size

  for (const cat of sourceCategories) {
    if (targetCategories.has(cat)) {
      intersection++
      shared.push(cat)
    }
  }

  const score = union === 0 ? 0 : intersection / union
  return { score, shared }
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function suggestPeopleForVenue(
  userId: string,
  venue: Venue,
  limit = 3
): SuggestedPerson[] {
  const userProfile = buildInterestProfile(userId)
  const userCategories = new Set(userProfile.weightedInterests.map(w => w.category.toLowerCase()))

  // Derive a representative time slot to check availability
  const bestSlot = suggestBestTimeSlot(userId, venue)
  const slotDate  = new Date(bestSlot.startTime)
  const timeSlot  = { dayOfWeek: slotDate.getDay(), hour: slotDate.getHours() }

  const candidates: PersonCandidate[] = []

  // Direct friends
  const friends = getFriends(userId)
  for (const friend of friends) {
    const friendProfile = buildInterestProfile(friend.id)
    const friendCats    = new Set(friendProfile.weightedInterests.map(w => w.category.toLowerCase()))

    const { score: sharedInterestScore, shared: sharedInterests } =
      computeSharedInterests(userCategories, friendCats)
    const venueCompatibilityScore = scoreVenueForUser(venue, friendProfile)
    const availabilityScore       = getFriendAvailability([friend.id], timeSlot)
    const engagementLevel         = getVenueEngagementLevel(friend.id, venue.id)
    const hasExpressedInterest    = engagementLevel !== null && engagementLevel !== 'viewed'

    candidates.push({
      userId:                friend.id,
      name:                  friend.name,
      reason:                'friend',
      socialProximity:       friend.edge.strength,
      sharedInterestScore,
      venueCompatibilityScore,
      availabilityScore,
      hasExpressedInterest,
      sharedInterests,
    })
  }

  // Mutual friends (depth-2)
  const directFriendIds = new Set(friends.map(f => f.id))
  const mutuals = getMutuals(userId)

  for (const mutual of mutuals) {
    if (directFriendIds.has(mutual.id)) continue

    const mutualProfile = buildInterestProfile(mutual.id)
    const mutualCats    = new Set(mutualProfile.weightedInterests.map(w => w.category.toLowerCase()))

    const { score: sharedInterestScore, shared: sharedInterests } =
      computeSharedInterests(userCategories, mutualCats)
    const venueCompatibilityScore = scoreVenueForUser(venue, mutualProfile)
    const availabilityScore       = getFriendAvailability([mutual.id], timeSlot)
    const engagementLevel         = getVenueEngagementLevel(mutual.id, venue.id)
    const hasExpressedInterest    = engagementLevel !== null && engagementLevel !== 'viewed'

    candidates.push({
      userId:                mutual.id,
      name:                  mutual.name,
      reason:                'mutual',
      socialProximity:       0.5,
      sharedInterestScore,
      venueCompatibilityScore,
      availabilityScore,
      hasExpressedInterest,
      sharedInterests,
    })
  }

  // Score and sort
  const scored = candidates.map(c => {
    const personScore =
      0.35 * c.sharedInterestScore +
      0.30 * c.socialProximity +
      0.20 * c.venueCompatibilityScore +
      0.15 * c.availabilityScore

    return { ...c, compatibilityScore: personScore }
  })

  scored.sort((a, b) => b.compatibilityScore - a.compatibilityScore)

  return scored.slice(0, limit).map(c => ({
    userId:               c.userId,
    name:                 c.name,
    reason:               c.reason,
    compatibilityScore:   c.compatibilityScore,
    hasExpressedInterest: c.hasExpressedInterest,
    sharedInterests:      c.sharedInterests,
  }))
}
