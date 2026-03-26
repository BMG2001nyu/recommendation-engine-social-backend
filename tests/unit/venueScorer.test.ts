import Database from 'better-sqlite3'
import { createTestDb, setDb, closeDb } from '../../src/db/database'
import { computeQualityScore, computeTrendingScore, type RawVenueRow } from '../../src/services/curation/venueScorer'
import { insertVenue } from '../helpers'
import { v4 as uuidv4 } from 'uuid'

let db: Database.Database

beforeEach(() => {
  db = createTestDb()
  setDb(db)
})

afterEach(() => {
  closeDb()
})

function makeRawVenueRow(overrides: Partial<RawVenueRow> = {}): RawVenueRow {
  const busynessPattern = Array.from({ length: 7 }, () => Array(24).fill(50))
  return {
    id: uuidv4(),
    name: 'Test Venue',
    category: 'jazz clubs',
    tags: JSON.stringify(['jazz', 'live music']),
    lat: 40.73,
    lng: -74.0,
    address: '123 Test St',
    city: 'New York',
    rating: 4.0,
    price_level: 2,
    busyness_pattern: JSON.stringify(busynessPattern),
    photos: JSON.stringify([]),
    vibe_description: null,
    quality_score: 0.5,
    trending_score: 0.0,
    engagement_count: 0,
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

describe('computeQualityScore', () => {
  it('returns a value between 0 and 1', () => {
    const venue = makeRawVenueRow({ rating: 4.0, photos: JSON.stringify([]) })
    const score = computeQualityScore(venue)
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(1)
  })

  it('higher rating produces a higher score', () => {
    const lowRating = makeRawVenueRow({ rating: 2.0 })
    const highRating = makeRawVenueRow({ rating: 5.0 })
    expect(computeQualityScore(highRating)).toBeGreaterThan(computeQualityScore(lowRating))
  })

  it('venue with vibe description scores higher than one without', () => {
    const withVibe = makeRawVenueRow({ vibe_description: 'Cozy jazz club with intimate lighting', rating: 4.0 })
    const withoutVibe = makeRawVenueRow({ vibe_description: null, rating: 4.0 })
    expect(computeQualityScore(withVibe)).toBeGreaterThan(computeQualityScore(withoutVibe))
  })

  it('more photos produces a higher score', () => {
    const noPhotos = makeRawVenueRow({ photos: JSON.stringify([]) })
    const manyPhotos = makeRawVenueRow({
      photos: JSON.stringify(['p1.jpg', 'p2.jpg', 'p3.jpg', 'p4.jpg', 'p5.jpg']),
    })
    expect(computeQualityScore(manyPhotos)).toBeGreaterThan(computeQualityScore(noPhotos))
  })
})

describe('computeTrendingScore', () => {
  it('returns 0 for a venue with no recent engagement events', () => {
    const venue = insertVenue(db)
    const score = computeTrendingScore(venue.id)
    expect(score).toBe(0)
  })

  it('returns a value greater than 0 after inserting recent engagement events', () => {
    const user = db.prepare('INSERT INTO users (id, name, email) VALUES (?, ?, ?) RETURNING id')
      .get(uuidv4(), 'Scorer User', `scorer-${uuidv4()}@test.com`) as { id: string }
    const venue = insertVenue(db)

    // Insert several recent engagement events (within the 48h window)
    const now = new Date()
    for (let i = 0; i < 6; i++) {
      const ts = new Date(now.getTime() - i * 3_600_000).toISOString()
      db.prepare(
        'INSERT INTO engagement_events (id, user_id, venue_id, event_type, timestamp) VALUES (?, ?, ?, ?, ?)'
      ).run(uuidv4(), user.id, venue.id, 'venue_view', ts)
    }

    const score = computeTrendingScore(venue.id)
    expect(score).toBeGreaterThan(0)
  })
})
