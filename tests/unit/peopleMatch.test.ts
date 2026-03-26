import Database from 'better-sqlite3'
import type { Venue } from '../../src/types'
import { createTestDb, setDb, closeDb } from '../../src/db/database'
import { suggestPeopleForVenue } from '../../src/services/recommendation/peopleMatch'
import {
  insertUser,
  insertVenue,
  insertSocialEdge,
  insertInterest,
  insertEngagement,
} from '../helpers'

let db: Database.Database

beforeEach(() => {
  db = createTestDb()
  setDb(db)
})

afterEach(() => {
  closeDb()
})

function buildVenueObject(partial: ReturnType<typeof insertVenue>): Venue {
  const busynessPattern = Array.from({ length: 7 }, () => Array(24).fill(50)) as number[][]
  return {
    id: partial.id,
    name: partial.name,
    category: partial.category,
    tags: partial.tags,
    lat: 40.73,
    lng: -74.0,
    address: '123 Test St',
    city: partial.city,
    rating: partial.rating,
    priceLevel: (partial.priceLevel ?? 2) as 1 | 2 | 3 | 4,
    busynessPattern: partial.busynessPattern ?? busynessPattern,
    photos: [],
    vibeDescription: 'Great vibe',
    qualityScore: partial.qualityScore,
    trendingScore: partial.trendingScore,
    engagementCount: 0,
    createdAt: new Date().toISOString(),
  }
}

describe('suggestPeopleForVenue', () => {
  it('returns empty array when user has no friends', () => {
    const user = insertUser(db)
    const venuePartial = insertVenue(db)
    const venue = buildVenueObject(venuePartial)

    const result = suggestPeopleForVenue(user.id, venue)

    expect(result).toEqual([])
  })

  it('returns a friend with reason "friend" for a direct social edge', () => {
    const user = insertUser(db)
    const friend = insertUser(db, { name: 'Alice' })
    const venuePartial = insertVenue(db)
    const venue = buildVenueObject(venuePartial)
    insertSocialEdge(db, user.id, friend.id, 0.8, 0.7)

    const result = suggestPeopleForVenue(user.id, venue)

    expect(result.length).toBeGreaterThan(0)
    const suggestion = result.find(s => s.userId === friend.id)
    expect(suggestion).toBeDefined()
    expect(suggestion?.reason).toBe('friend')
  })

  it('hasExpressedInterest is true for a friend who engaged with the venue (not just viewed)', () => {
    const user = insertUser(db)
    const friend = insertUser(db, { name: 'Bob' })
    const venuePartial = insertVenue(db)
    const venue = buildVenueObject(venuePartial)
    insertSocialEdge(db, user.id, friend.id, 0.8, 0.7)
    insertEngagement(db, friend.id, venue.id, 'interested')

    const result = suggestPeopleForVenue(user.id, venue)

    const suggestion = result.find(s => s.userId === friend.id)
    expect(suggestion).toBeDefined()
    expect(suggestion?.hasExpressedInterest).toBe(true)
  })

  it('hasExpressedInterest is false for a friend who has not engaged with the venue', () => {
    const user = insertUser(db)
    const friend = insertUser(db, { name: 'Carol' })
    const venuePartial = insertVenue(db)
    const venue = buildVenueObject(venuePartial)
    insertSocialEdge(db, user.id, friend.id, 0.8, 0.7)

    const result = suggestPeopleForVenue(user.id, venue)

    const suggestion = result.find(s => s.userId === friend.id)
    expect(suggestion).toBeDefined()
    expect(suggestion?.hasExpressedInterest).toBe(false)
  })

  it('returns at most the specified limit of people', () => {
    const user = insertUser(db)
    const venuePartial = insertVenue(db)
    const venue = buildVenueObject(venuePartial)

    for (let i = 0; i < 5; i++) {
      const friend = insertUser(db, { name: `Friend ${i}` })
      insertSocialEdge(db, user.id, friend.id, 0.8, 0.7)
    }

    const limit = 3
    const result = suggestPeopleForVenue(user.id, venue, limit)

    expect(result.length).toBeLessThanOrEqual(limit)
  })

  it('friend with shared interests scores higher than friend with no overlap', () => {
    const user = insertUser(db)
    insertInterest(db, user.id, 'jazz clubs', 0.9)

    const sharedFriend = insertUser(db, { name: 'Jazz Fan' })
    insertInterest(db, sharedFriend.id, 'jazz clubs', 0.8)
    insertSocialEdge(db, user.id, sharedFriend.id, 0.5, 0.5)

    const noOverlapFriend = insertUser(db, { name: 'Sports Fan' })
    insertInterest(db, noOverlapFriend.id, 'sports bars', 0.8)
    insertSocialEdge(db, user.id, noOverlapFriend.id, 0.5, 0.5)

    const venuePartial = insertVenue(db, { category: 'jazz clubs' })
    const venue = buildVenueObject(venuePartial)

    const result = suggestPeopleForVenue(user.id, venue, 5)

    const sharedScore = result.find(s => s.userId === sharedFriend.id)?.compatibilityScore ?? 0
    const noOverlapScore = result.find(s => s.userId === noOverlapFriend.id)?.compatibilityScore ?? 0

    expect(sharedScore).toBeGreaterThan(noOverlapScore)
  })

  it('sharedInterests array contains the overlapping categories', () => {
    const user = insertUser(db)
    insertInterest(db, user.id, 'jazz clubs', 0.9)
    insertInterest(db, user.id, 'cocktail bars', 0.7)

    const friend = insertUser(db, { name: 'Jazz Lover' })
    insertInterest(db, friend.id, 'jazz clubs', 0.8)
    insertSocialEdge(db, user.id, friend.id, 0.8, 0.7)

    const venuePartial = insertVenue(db, { category: 'jazz clubs' })
    const venue = buildVenueObject(venuePartial)

    const result = suggestPeopleForVenue(user.id, venue, 5)

    const suggestion = result.find(s => s.userId === friend.id)
    expect(suggestion).toBeDefined()
    expect(suggestion?.sharedInterests).toContain('jazz clubs')
  })
})
