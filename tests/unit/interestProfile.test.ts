import Database from 'better-sqlite3'
import { createTestDb, setDb, closeDb } from '../../src/db/database'
import { buildInterestProfile, getDistinctivenessMap } from '../../src/services/recommendation/interestProfile'
import { insertUser, insertVenue, insertInterest, insertEngagement } from '../helpers'
import { v4 as uuidv4 } from 'uuid'

let db: Database.Database

beforeEach(() => {
  db = createTestDb()
  setDb(db)
})

afterEach(() => {
  closeDb()
})

describe('buildInterestProfile', () => {
  it('returns a profile with weighted interests for a user who has interests', () => {
    const user = insertUser(db)
    insertInterest(db, user.id, 'jazz clubs', 0.9)
    insertInterest(db, user.id, 'cocktail bars', 0.6)

    const profile = buildInterestProfile(user.id)

    expect(profile.userId).toBe(user.id)
    expect(profile.weightedInterests.length).toBe(2)
    expect(profile.weightedInterests[0].category).toBeDefined()
    expect(profile.weightedInterests[0].finalWeight).toBeGreaterThan(0)
  })

  it('returns empty interests array for a user with no interests', () => {
    const user = insertUser(db)

    const profile = buildInterestProfile(user.id)

    expect(profile.userId).toBe(user.id)
    expect(profile.weightedInterests).toEqual([])
  })

  it('finalWeight equals rawWeight multiplied by distinctiveness', () => {
    const user = insertUser(db)
    insertInterest(db, user.id, 'jazz clubs', 0.8)

    const profile = buildInterestProfile(user.id)

    expect(profile.weightedInterests.length).toBeGreaterThan(0)
    const wi = profile.weightedInterests[0]
    // finalWeight before normalisation = rawWeight * distinctiveness
    // After normalisation: when only one interest, max is itself, so finalWeight = 1.0
    expect(wi.rawWeight).toBeCloseTo(0.8)
    expect(wi.distinctiveness).toBeGreaterThan(0)
    // The product normalised by max should equal finalWeight
    // maxFinal = max(rawWeight * distinctiveness, 1)
    const expectedRaw = wi.rawWeight * wi.distinctiveness
    const maxFinal = Math.max(expectedRaw, 1)
    expect(wi.finalWeight).toBeCloseTo(expectedRaw / maxFinal)
  })

  it('behaviorSignals.saveRate is 0 for a user with no engagement events', () => {
    const user = insertUser(db)
    insertInterest(db, user.id, 'jazz clubs', 0.8)

    const profile = buildInterestProfile(user.id)

    expect(profile.behaviorSignals.saveRate).toBe(0)
  })

  it('behaviorSignals.pricePreference is calculated from engaged venues', () => {
    const user = insertUser(db)
    const venue = insertVenue(db, { priceLevel: 4 })
    insertInterest(db, user.id, 'jazz clubs', 0.8)

    // Insert an engagement event that links to the venue so pricePreference is computed
    db.prepare(
      'INSERT INTO engagement_events (id, user_id, venue_id, event_type) VALUES (?, ?, ?, ?)'
    ).run(uuidv4(), user.id, venue.id, 'venue_view')

    const profile = buildInterestProfile(user.id)

    // pricePreference should reflect the price level of the engaged venue
    expect(profile.behaviorSignals.pricePreference).toBe(4)
  })
})

describe('getDistinctivenessMap', () => {
  it('rare interest (1 user) gets higher score than common interest (many users)', () => {
    // Create several users with a common interest
    const users = Array.from({ length: 5 }, () => insertUser(db))
    for (const u of users) {
      insertInterest(db, u.id, 'cocktail bars', 0.5)
    }

    // One user with a rare interest
    const rareUser = insertUser(db)
    insertInterest(db, rareUser.id, 'exotic cheese tastings', 0.5)

    const allUserIds = [...users, rareUser].map(u => u.id)
    const map = getDistinctivenessMap(allUserIds)

    expect(map['exotic cheese tastings']).toBeGreaterThan(map['cocktail bars'])
  })
})
