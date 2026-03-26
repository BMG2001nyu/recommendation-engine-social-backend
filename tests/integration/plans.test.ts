import Database from 'better-sqlite3'
import request from 'supertest'
import { createTestDb, setDb, closeDb } from '../../src/db/database'
import { createApp } from '../../src/app'
import { insertUser, insertVenue } from '../helpers'

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

const futureTime = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

describe('POST /api/plans', () => {
  it('creates a plan and returns 201', async () => {
    const user = insertUser(db)
    const venue = insertVenue(db)

    const response = await request(app)
      .post('/api/plans')
      .send({ venueId: venue.id, createdBy: user.id, scheduledTime: futureTime })

    expect(response.status).toBe(201)
    expect(response.body).toHaveProperty('id')
    expect(response.body).toHaveProperty('venueId', venue.id)
    expect(response.body).toHaveProperty('createdBy', user.id)
  })

  it('creator is added as an accepted participant', async () => {
    const user = insertUser(db)
    const venue = insertVenue(db)

    const response = await request(app)
      .post('/api/plans')
      .send({ venueId: venue.id, createdBy: user.id, scheduledTime: futureTime })

    expect(response.status).toBe(201)
    expect(response.body).toHaveProperty('participants')
    const creator = response.body.participants.find(
      (p: { userId: string; status: string }) => p.userId === user.id
    )
    expect(creator).toBeDefined()
    expect(creator.status).toBe('accepted')
  })

  it('inviteeIds are added with "invited" status', async () => {
    const creator = insertUser(db)
    const invitee1 = insertUser(db, { name: 'Invitee One' })
    const invitee2 = insertUser(db, { name: 'Invitee Two' })
    const venue = insertVenue(db)

    const response = await request(app)
      .post('/api/plans')
      .send({
        venueId: venue.id,
        createdBy: creator.id,
        scheduledTime: futureTime,
        inviteeIds: [invitee1.id, invitee2.id],
      })

    expect(response.status).toBe(201)
    const inv1 = response.body.participants.find(
      (p: { userId: string; status: string }) => p.userId === invitee1.id
    )
    const inv2 = response.body.participants.find(
      (p: { userId: string; status: string }) => p.userId === invitee2.id
    )
    expect(inv1?.status).toBe('invited')
    expect(inv2?.status).toBe('invited')
  })
})

describe('GET /api/plans/:planId', () => {
  it('returns the plan with venue and participants', async () => {
    const user = insertUser(db)
    const venue = insertVenue(db)

    const createRes = await request(app)
      .post('/api/plans')
      .send({ venueId: venue.id, createdBy: user.id, scheduledTime: futureTime })

    const planId = createRes.body.id

    const response = await request(app).get(`/api/plans/${planId}`)

    expect(response.status).toBe(200)
    expect(response.body).toHaveProperty('id', planId)
    expect(response.body).toHaveProperty('venue')
    expect(response.body.venue).toHaveProperty('id', venue.id)
    expect(response.body).toHaveProperty('participants')
    expect(Array.isArray(response.body.participants)).toBe(true)
  })

  it('returns 404 for a nonexistent plan', async () => {
    const response = await request(app).get('/api/plans/nonexistent-plan-id')

    expect(response.status).toBe(404)
  })
})

describe('POST /api/plans/:planId/invites', () => {
  it('adds new participants to an existing plan', async () => {
    const creator = insertUser(db)
    const newInvitee = insertUser(db, { name: 'New Invitee' })
    const venue = insertVenue(db)

    const createRes = await request(app)
      .post('/api/plans')
      .send({ venueId: venue.id, createdBy: creator.id, scheduledTime: futureTime })

    const planId = createRes.body.id

    const response = await request(app)
      .post(`/api/plans/${planId}/invites`)
      .send({ userIds: [newInvitee.id], invitedBy: creator.id })

    expect(response.status).toBe(201)
    expect(Array.isArray(response.body) || response.body.invited !== undefined).toBe(true)

    // Verify the invitee was added
    const planRes = await request(app).get(`/api/plans/${planId}`)
    const addedParticipant = planRes.body.participants.find(
      (p: { userId: string }) => p.userId === newInvitee.id
    )
    expect(addedParticipant).toBeDefined()
  })
})

describe('POST /api/plans/:planId/respond', () => {
  it('updating response to "accepted" updates participant status', async () => {
    const creator = insertUser(db)
    const invitee = insertUser(db, { name: 'Invitee' })
    const venue = insertVenue(db)

    const createRes = await request(app)
      .post('/api/plans')
      .send({
        venueId: venue.id,
        createdBy: creator.id,
        scheduledTime: futureTime,
        inviteeIds: [invitee.id],
      })

    const planId = createRes.body.id

    const response = await request(app)
      .post(`/api/plans/${planId}/respond`)
      .send({ userId: invitee.id, response: 'accepted' })

    expect(response.status).toBe(200)
    expect(response.body).toHaveProperty('status', 'accepted')

    // Verify the status was updated in the plan
    const planRes = await request(app).get(`/api/plans/${planId}`)
    const participant = planRes.body.participants.find(
      (p: { userId: string; status: string }) => p.userId === invitee.id
    )
    expect(participant?.status).toBe('accepted')
  })
})

describe('GET /api/plans/invitations/:userId', () => {
  it('returns plans the user was invited to with "invited" status', async () => {
    const creator = insertUser(db)
    const invitee = insertUser(db, { name: 'Invited User' })
    const venue = insertVenue(db)

    await request(app)
      .post('/api/plans')
      .send({
        venueId: venue.id,
        createdBy: creator.id,
        scheduledTime: futureTime,
        inviteeIds: [invitee.id],
      })

    const response = await request(app).get(`/api/plans/invitations/${invitee.id}`)

    expect(response.status).toBe(200)
    expect(response.body).toHaveProperty('invitations')
    expect(response.body.invitations.length).toBeGreaterThan(0)
    expect(response.body).toHaveProperty('count')
  })
})
