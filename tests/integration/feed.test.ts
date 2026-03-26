import Database from 'better-sqlite3'
import request from 'supertest'
import { createTestDb, setDb, closeDb } from '../../src/db/database'
import { createApp } from '../../src/app'
import {
  insertUser,
  insertVenue,
  insertSocialEdge,
  insertInterest,
  insertEngagement,
} from '../helpers'
import { v4 as uuidv4 } from 'uuid'

// Disable real Anthropic calls in tests
process.env.ANTHROPIC_API_KEY = ''

let db: Database.Database
const app = createApp()

beforeEach(() => {
  db = createTestDb()
  setDb(db)
})

afterEach(() => {
  closeDb()
})

function seedFeedData(db: Database.Database) {
  const user1 = insertUser(db, { name: 'Alice', city: 'New York' })
  const user2 = insertUser(db, { name: 'Bob', city: 'New York' })

  const venue1 = insertVenue(db, { name: 'Jazz Bar', category: 'jazz clubs', city: 'New York', qualityScore: 0.9, trendingScore: 0.7 })
  const venue2 = insertVenue(db, { name: 'Cocktail Lounge', category: 'cocktail bars', city: 'New York', qualityScore: 0.8, trendingScore: 0.5 })
  const venue3 = insertVenue(db, { name: 'Rooftop Terrace', category: 'rooftop bars', city: 'New York', qualityScore: 0.85, trendingScore: 0.6 })

  insertSocialEdge(db, user1.id, user2.id, 0.8, 0.7)
  insertInterest(db, user1.id, 'jazz clubs', 0.9)
  insertInterest(db, user2.id, 'cocktail bars', 0.8)

  return { user1, user2, venue1, venue2, venue3 }
}

describe('GET /api/feed/:userId', () => {
  it('returns 200 with a recommendations array', async () => {
    const { user1 } = seedFeedData(db)

    const response = await request(app).get(`/api/feed/${user1.id}`)

    expect(response.status).toBe(200)
    expect(Array.isArray(response.body.recommendations)).toBe(true)
  })

  it('response has userId, generatedAt, strategy, and count fields', async () => {
    const { user1 } = seedFeedData(db)

    const response = await request(app).get(`/api/feed/${user1.id}`)

    expect(response.status).toBe(200)
    expect(response.body).toHaveProperty('userId', user1.id)
    expect(response.body).toHaveProperty('generatedAt')
    expect(response.body).toHaveProperty('strategy')
    expect(response.body).toHaveProperty('count')
  })

  it('each recommendation has venue, suggestedPeople, suggestedTime, score, and socialProof', async () => {
    const { user1 } = seedFeedData(db)
    // Give user1 some engagement history so they get personalized results
    const venue = insertVenue(db, { city: 'New York' })
    insertEngagement(db, user1.id, venue.id, 'interested')
    db.prepare('INSERT INTO engagement_events (id, user_id, venue_id, event_type) VALUES (?, ?, ?, ?)')
      .run(uuidv4(), user1.id, venue.id, 'venue_view')

    const response = await request(app).get(`/api/feed/${user1.id}`)

    expect(response.status).toBe(200)
    if (response.body.recommendations.length > 0) {
      const rec = response.body.recommendations[0]
      expect(rec).toHaveProperty('venue')
      expect(rec).toHaveProperty('suggestedPeople')
      expect(rec).toHaveProperty('suggestedTime')
      expect(rec).toHaveProperty('score')
      expect(rec).toHaveProperty('socialProof')
    }
  })

  it('cold start user (no engagement events) gets strategy "cold_start"', async () => {
    // Fresh user with no events at all
    const coldUser = insertUser(db, { name: 'New User', city: 'New York' })
    // Add some venues for them to see
    insertVenue(db, { city: 'New York', qualityScore: 0.9 })
    insertVenue(db, { city: 'New York', qualityScore: 0.85 })

    const response = await request(app).get(`/api/feed/${coldUser.id}`)

    expect(response.status).toBe(200)
    expect(response.body.strategy).toBe('cold_start')
  })

  it('returns 404 for a nonexistent user', async () => {
    const response = await request(app).get('/api/feed/nonexistent-user-id')

    expect(response.status).toBe(404)
  })

  it('returns at most limit recommendations when ?limit=3', async () => {
    const { user1 } = seedFeedData(db)

    const response = await request(app).get(`/api/feed/${user1.id}?limit=3`)

    expect(response.status).toBe(200)
    expect(response.body.recommendations.length).toBeLessThanOrEqual(3)
  })

  it('socialProof.momentumTrend is "cold" for a venue with no engagements', async () => {
    const user = insertUser(db, { name: 'Solo User', city: 'New York' })
    // Venue with zero engagements
    insertVenue(db, { name: 'Empty Venue', city: 'New York', qualityScore: 0.9 })

    const response = await request(app).get(`/api/feed/${user.id}`)

    expect(response.status).toBe(200)
    if (response.body.recommendations.length > 0) {
      const emptyVenueRec = response.body.recommendations.find(
        (r: { venue: { name: string }; socialProof: { momentumTrend: string } }) => r.venue.name === 'Empty Venue'
      )
      if (emptyVenueRec) {
        expect(emptyVenueRec.socialProof.momentumTrend).toBe('cold')
      }
    }
  })
})
