import Database from 'better-sqlite3'
import type { Venue } from '../../src/types'
import { createTestDb, setDb, closeDb } from '../../src/db/database'
import { suggestBestTimeSlot } from '../../src/services/temporal/timeOptimizer'
import { sweetSpotScore } from '../../src/services/temporal/busynessModel'
import {
  insertUser,
  insertVenue,
  insertSocialEdge,
  insertAvailability,
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
    busynessPattern: partial.busynessPattern,
    photos: [],
    vibeDescription: 'Great vibe',
    qualityScore: partial.qualityScore,
    trendingScore: partial.trendingScore,
    engagementCount: 0,
    createdAt: new Date().toISOString(),
  }
}

describe('sweetSpotScore', () => {
  it('returns approximately 1.0 at busyness=60 (the peak)', () => {
    const score = sweetSpotScore(60)
    expect(score).toBeCloseTo(1.0)
  })

  it('returns a very low score for busyness=0 (too empty)', () => {
    const score = sweetSpotScore(0)
    expect(score).toBeLessThan(0.1)
  })

  it('returns a low score for busyness=100 (too busy)', () => {
    const score = sweetSpotScore(100)
    expect(score).toBeLessThan(0.2)
  })

  it('busyness=40 scores higher than busyness=20 (40 is closer to 60)', () => {
    expect(sweetSpotScore(40)).toBeGreaterThan(sweetSpotScore(20))
  })
})

describe('suggestBestTimeSlot', () => {
  it('returns a TimeSlot with all required fields', () => {
    const user = insertUser(db)
    const venuePartial = insertVenue(db)
    const venue = buildVenueObject(venuePartial)

    const slot = suggestBestTimeSlot(user.id, venue)

    expect(slot).toHaveProperty('startTime')
    expect(slot).toHaveProperty('endTime')
    expect(slot).toHaveProperty('confidence')
    expect(slot).toHaveProperty('reasoning')
    expect(slot).toHaveProperty('availableFriendCount')
    expect(slot).toHaveProperty('busynessLevel')
  })

  it('slot with more available friends has higher or equal confidence', () => {
    const user = insertUser(db)

    // Scenario 1: no friends
    const venuePartial1 = insertVenue(db)
    const venue1 = buildVenueObject(venuePartial1)
    const slotNoFriends = suggestBestTimeSlot(user.id, venue1)

    // Scenario 2: user with friends who are all available on Friday at 20:00
    const user2 = insertUser(db)
    const friend1 = insertUser(db, { name: 'Friend A' })
    const friend2 = insertUser(db, { name: 'Friend B' })
    insertSocialEdge(db, user2.id, friend1.id)
    insertSocialEdge(db, user2.id, friend2.id)
    // Mark friends available on Friday (5) at 20:00
    insertAvailability(db, friend1.id, 5, 20)
    insertAvailability(db, friend2.id, 5, 20)

    const venuePartial2 = insertVenue(db)
    const venue2 = buildVenueObject(venuePartial2)
    const slotWithFriends = suggestBestTimeSlot(user2.id, venue2)

    expect(slotWithFriends.confidence).toBeGreaterThanOrEqual(slotNoFriends.confidence)
  })

  it('startTime is a valid ISO datetime string in the future', () => {
    const user = insertUser(db)
    const venuePartial = insertVenue(db)
    const venue = buildVenueObject(venuePartial)

    const slot = suggestBestTimeSlot(user.id, venue)

    const startDate = new Date(slot.startTime)
    expect(isNaN(startDate.getTime())).toBe(false)
    expect(startDate.getTime()).toBeGreaterThan(Date.now())
  })
})
