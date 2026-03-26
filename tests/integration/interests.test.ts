import Database from 'better-sqlite3'
import request from 'supertest'
import { createTestDb, setDb, closeDb } from '../../src/db/database'
import { createApp } from '../../src/app'
import { insertUser, insertVenue, insertEngagement } from '../helpers'

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

describe('POST /api/interests', () => {
  it('returns 201 with the engagement object', async () => {
    const user = insertUser(db)
    const venue = insertVenue(db)

    const response = await request(app)
      .post('/api/interests')
      .send({ userId: user.id, venueId: venue.id, level: 'interested' })

    expect(response.status).toBe(201)
    expect(response.body).toHaveProperty('id')
    expect(response.body).toHaveProperty('userId', user.id)
    expect(response.body).toHaveProperty('venueId', venue.id)
    expect(response.body).toHaveProperty('level', 'interested')
  })

  it('upgrading from "viewed" to "interested" works', async () => {
    const user = insertUser(db)
    const venue = insertVenue(db)
    insertEngagement(db, user.id, venue.id, 'viewed')

    const response = await request(app)
      .post('/api/interests')
      .send({ userId: user.id, venueId: venue.id, level: 'interested' })

    expect(response.status).toBe(201)
    expect(response.body.level).toBe('interested')
  })

  it('cannot downgrade: posting "viewed" when already "interested" keeps "interested"', async () => {
    const user = insertUser(db)
    const venue = insertVenue(db)
    insertEngagement(db, user.id, venue.id, 'interested')

    const response = await request(app)
      .post('/api/interests')
      .send({ userId: user.id, venueId: venue.id, level: 'viewed' })

    expect(response.status).toBe(201)
    expect(response.body.level).toBe('interested')
  })

  it('returns 400 for an invalid request body', async () => {
    const response = await request(app)
      .post('/api/interests')
      .send({ userId: 'not-a-uuid', venueId: 'some-venue', level: 'invalid-level' })

    expect(response.status).toBe(400)
  })
})

describe('GET /api/interests/:userId', () => {
  it('returns all engagements for the user', async () => {
    const user = insertUser(db)
    const venue1 = insertVenue(db)
    const venue2 = insertVenue(db)
    insertEngagement(db, user.id, venue1.id, 'interested')
    insertEngagement(db, user.id, venue2.id, 'planning')

    const response = await request(app).get(`/api/interests/${user.id}`)

    expect(response.status).toBe(200)
    expect(response.body).toHaveProperty('engagements')
    expect(response.body.engagements.length).toBe(2)
    expect(response.body).toHaveProperty('count', 2)
  })
})

describe('GET /api/interests/venue/:venueId', () => {
  it('returns all engagements for the venue', async () => {
    const user1 = insertUser(db)
    const user2 = insertUser(db)
    const venue = insertVenue(db)
    insertEngagement(db, user1.id, venue.id, 'interested')
    insertEngagement(db, user2.id, venue.id, 'confirmed')

    const response = await request(app).get(`/api/interests/venue/${venue.id}`)

    expect(response.status).toBe(200)
    expect(response.body).toHaveProperty('engagements')
    expect(response.body.engagements.length).toBe(2)
  })
})
