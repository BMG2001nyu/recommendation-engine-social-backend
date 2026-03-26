/**
 * Top-level services barrel.
 * Provides CRUD helpers used by the API layer and re-exports all sub-services.
 */

import { v4 as uuidv4 } from 'uuid'
import type {
  User,
  Venue,
  VenueEngagement,
  Plan,
  PlanWithDetails,
  PlanParticipant,
  InterestLevel,
  SocialProof,
  SocialEdge,
  CreatePlanRequest,
} from '../types'
import { INTEREST_LEVEL_ORDER } from '../types'
import { getDb } from '../db/database'
import { eventBus } from '../events/eventBus'
import { rowToVenue, type RawVenueRow } from './curation/venueScorer'
import { propagateEngagement } from './propagation/signalPropagator'
import { getFriends } from './propagation/graphTraversal'
import { getSocialProofForVenue } from './recommendation/engine'

// ─── Re-exports ───────────────────────────────────────────────────────────────

export * from './curation'
export * from './recommendation'
export * from './propagation'
export * from './temporal'
export { initiateBooking } from './agent/bookingAgent'

// ─── DB row shapes ────────────────────────────────────────────────────────────

interface UserRow {
  id: string
  name: string
  email: string
  lat: number
  lng: number
  city: string
  created_at: string
}

interface EngagementRow {
  id: string
  user_id: string
  venue_id: string
  level: InterestLevel
  created_at: string
  updated_at: string
}

interface PlanRow {
  id: string
  venue_id: string
  created_by: string
  scheduled_time: string
  status: string
  booking_reference: string | null
  booking_details: string | null
  created_at: string
  updated_at: string
}

interface ParticipantRow {
  plan_id: string
  user_id: string
  status: string
  invited_by: string
  responded_at: string | null
  created_at: string
}

// ─── Row converters ───────────────────────────────────────────────────────────

function rowToUser(row: UserRow): User {
  return {
    id:        row.id,
    name:      row.name,
    email:     row.email,
    lat:       row.lat,
    lng:       row.lng,
    city:      row.city,
    createdAt: row.created_at,
  }
}

function rowToPlan(row: PlanRow): Plan {
  return {
    id:               row.id,
    venueId:          row.venue_id,
    createdBy:        row.created_by,
    scheduledTime:    row.scheduled_time,
    status:           row.status as Plan['status'],
    bookingReference: row.booking_reference ?? undefined,
    bookingDetails:   row.booking_details ? JSON.parse(row.booking_details) : undefined,
    createdAt:        row.created_at,
    updatedAt:        row.updated_at,
  }
}

function rowToParticipant(row: ParticipantRow): PlanParticipant {
  return {
    planId:      row.plan_id,
    userId:      row.user_id,
    status:      row.status as PlanParticipant['status'],
    invitedBy:   row.invited_by,
    respondedAt: row.responded_at ?? undefined,
    createdAt:   row.created_at,
  }
}

// ─── Plan assembly ────────────────────────────────────────────────────────────

function assemblePlanWithDetails(planRow: PlanRow): PlanWithDetails | null {
  const db = getDb()

  const venueRow = db.prepare('SELECT * FROM venues WHERE id = ?').get(planRow.venue_id) as RawVenueRow | undefined
  if (!venueRow) return null

  type JoinedParticipant = ParticipantRow & {
    u_id: string; u_name: string; u_email: string
    u_lat: number; u_lng: number; u_city: string; u_created: string
  }

  const participantRows = db.prepare(`
    SELECT
      pp.plan_id, pp.user_id, pp.status, pp.invited_by, pp.responded_at, pp.created_at,
      u.id     AS u_id,
      u.name   AS u_name,
      u.email  AS u_email,
      u.lat    AS u_lat,
      u.lng    AS u_lng,
      u.city   AS u_city,
      u.created_at AS u_created
    FROM plan_participants pp
    JOIN users u ON u.id = pp.user_id
    WHERE pp.plan_id = ?
  `).all(planRow.id) as JoinedParticipant[]

  const participants = participantRows.map(r => ({
    ...rowToParticipant(r),
    user: {
      id:        r.u_id,
      name:      r.u_name,
      email:     r.u_email,
      lat:       r.u_lat,
      lng:       r.u_lng,
      city:      r.u_city,
      createdAt: r.u_created,
    } satisfies User,
  }))

  return {
    ...rowToPlan(planRow),
    venue:        rowToVenue(venueRow),
    participants,
  }
}

// ─── Venue helpers ────────────────────────────────────────────────────────────

export function getVenue(venueId: string): Venue | null {
  const db  = getDb()
  const row = db.prepare('SELECT * FROM venues WHERE id = ?').get(venueId) as RawVenueRow | undefined
  return row ? rowToVenue(row) : null
}

export function getVenueWithSocialProof(
  venueId: string,
  userId: string
): (Venue & { socialProof: SocialProof }) | null {
  const venue = getVenue(venueId)
  if (!venue) return null
  return { ...venue, socialProof: getSocialProofForVenue(venueId, userId) }
}

// ─── Engagement helpers ───────────────────────────────────────────────────────

export function expressInterest(
  userId: string,
  venueId: string,
  level: InterestLevel
): VenueEngagement {
  const db  = getDb()
  const now = new Date().toISOString()

  const existing = db.prepare(
    'SELECT * FROM venue_engagements WHERE user_id = ? AND venue_id = ?'
  ).get(userId, venueId) as EngagementRow | undefined

  if (existing) {
    if (INTEREST_LEVEL_ORDER[level] <= INTEREST_LEVEL_ORDER[existing.level]) {
      return {
        id:        existing.id,
        userId:    existing.user_id,
        venueId:   existing.venue_id,
        level:     existing.level,
        createdAt: existing.created_at,
        updatedAt: existing.updated_at,
      }
    }

    db.prepare(`
      UPDATE venue_engagements SET level = ?, updated_at = ? WHERE id = ?
    `).run(level, now, existing.id)

    void propagateEngagement(userId, venueId, level)
    void eventBus.publish('interest_expressed', userId, { venueId, metadata: { level } })

    return {
      id:        existing.id,
      userId,
      venueId,
      level,
      createdAt: existing.created_at,
      updatedAt: now,
    }
  }

  const id = uuidv4()
  db.prepare(`
    INSERT INTO venue_engagements (id, user_id, venue_id, level, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, userId, venueId, level, now, now)

  db.prepare('UPDATE venues SET engagement_count = engagement_count + 1 WHERE id = ?').run(venueId)

  void propagateEngagement(userId, venueId, level)
  void eventBus.publish('interest_expressed', userId, { venueId, metadata: { level } })

  return { id, userId, venueId, level, createdAt: now, updatedAt: now }
}

export function getUserEngagements(userId: string): VenueEngagement[] {
  const db   = getDb()
  const rows = db.prepare('SELECT * FROM venue_engagements WHERE user_id = ?').all(userId) as EngagementRow[]
  return rows.map(r => ({
    id:        r.id,
    userId:    r.user_id,
    venueId:   r.venue_id,
    level:     r.level,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }))
}

export function getVenueEngagements(venueId: string): VenueEngagement[] {
  const db   = getDb()
  const rows = db.prepare('SELECT * FROM venue_engagements WHERE venue_id = ?').all(venueId) as EngagementRow[]
  return rows.map(r => ({
    id:        r.id,
    userId:    r.user_id,
    venueId:   r.venue_id,
    level:     r.level,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }))
}

// ─── Plan helpers ─────────────────────────────────────────────────────────────

export function createPlan(req: CreatePlanRequest): PlanWithDetails {
  const db  = getDb()
  const now = new Date().toISOString()
  const id  = uuidv4()

  db.prepare(`
    INSERT INTO plans (id, venue_id, created_by, scheduled_time, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'open', ?, ?)
  `).run(id, req.venueId, req.createdBy, req.scheduledTime, now, now)

  db.prepare(`
    INSERT INTO plan_participants (plan_id, user_id, status, invited_by, created_at)
    VALUES (?, ?, 'accepted', ?, ?)
  `).run(id, req.createdBy, req.createdBy, now)

  if (req.inviteeIds && req.inviteeIds.length > 0) {
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO plan_participants (plan_id, user_id, status, invited_by, created_at)
      VALUES (?, ?, 'invited', ?, ?)
    `)
    for (const uid of req.inviteeIds) stmt.run(id, uid, req.createdBy, now)
  }

  void eventBus.publish('plan_created', req.createdBy, {
    planId: id, venueId: req.venueId, metadata: {},
  })

  const planRow = db.prepare('SELECT * FROM plans WHERE id = ?').get(id) as PlanRow
  const result  = assemblePlanWithDetails(planRow)
  if (!result) throw new Error(`Failed to assemble plan ${id}`)
  return result
}

export function getPlan(planId: string): PlanWithDetails | null {
  const db      = getDb()
  const planRow = db.prepare('SELECT * FROM plans WHERE id = ?').get(planId) as PlanRow | undefined
  if (!planRow) return null
  return assemblePlanWithDetails(planRow)
}

export function getUserPlans(userId: string): PlanWithDetails[] {
  const db   = getDb()
  const rows = db.prepare(
    'SELECT * FROM plans WHERE created_by = ? ORDER BY created_at DESC'
  ).all(userId) as PlanRow[]
  return rows.flatMap(r => {
    const p = assemblePlanWithDetails(r)
    return p ? [p] : []
  })
}

export function sendInvites(planId: string, userIds: string[], invitedBy: string): PlanParticipant[] {
  const db  = getDb()
  const now = new Date().toISOString()
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO plan_participants (plan_id, user_id, status, invited_by, created_at)
    VALUES (?, ?, 'invited', ?, ?)
  `)
  for (const uid of userIds) {
    stmt.run(planId, uid, invitedBy, now)
    void eventBus.publish('invite_sent', invitedBy, { planId, metadata: { inviteeId: uid } })
  }

  const ph   = userIds.map(() => '?').join(',')
  const rows = db.prepare(
    `SELECT * FROM plan_participants WHERE plan_id = ? AND user_id IN (${ph})`
  ).all(planId, ...userIds) as ParticipantRow[]

  return rows.map(rowToParticipant)
}

export function respondToInvite(
  planId: string,
  userId: string,
  response: 'accepted' | 'declined' | 'maybe'
): PlanParticipant {
  const db  = getDb()
  const now = new Date().toISOString()

  db.prepare(`
    UPDATE plan_participants SET status = ?, responded_at = ? WHERE plan_id = ? AND user_id = ?
  `).run(response, now, planId, userId)

  const evtType = response === 'accepted'
    ? 'invite_accepted'
    : response === 'declined'
    ? 'invite_declined'
    : 'invite_accepted'

  void eventBus.publish(evtType, userId, { planId, metadata: { response } })

  // Auto-confirm when no more pending invites
  const allRows = db.prepare(
    'SELECT status FROM plan_participants WHERE plan_id = ?'
  ).all(planId) as Array<{ status: string }>

  const pending  = allRows.filter(p => p.status === 'invited').length
  const accepted = allRows.filter(p => p.status === 'accepted').length
  if (pending === 0 && accepted > 0) {
    db.prepare(`UPDATE plans SET status = 'confirmed', updated_at = ? WHERE id = ?`).run(now, planId)
    void eventBus.publish('plan_confirmed', userId, { planId, metadata: {} })
  }

  const row = db.prepare(
    'SELECT * FROM plan_participants WHERE plan_id = ? AND user_id = ?'
  ).get(planId, userId) as ParticipantRow
  return rowToParticipant(row)
}

export function getUserInvitations(userId: string): PlanWithDetails[] {
  const db   = getDb()
  const rows = db.prepare(`
    SELECT p.*
    FROM plans p
    JOIN plan_participants pp ON pp.plan_id = p.id
    WHERE pp.user_id = ? AND pp.invited_by != ?
    ORDER BY p.created_at DESC
  `).all(userId, userId) as PlanRow[]

  return rows.flatMap(r => {
    const p = assemblePlanWithDetails(r)
    return p ? [p] : []
  })
}

// ─── User helpers ─────────────────────────────────────────────────────────────

export function getUser(userId: string): User | null {
  const db  = getDb()
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as UserRow | undefined
  return row ? rowToUser(row) : null
}

export function getUserFriends(userId: string): Array<User & { edge: SocialEdge }> {
  return getFriends(userId).map(f => ({
    id:        f.id,
    name:      f.name,
    email:     f.email,
    lat:       f.lat,
    lng:       f.lng,
    city:      f.city,
    createdAt: f.createdAt,
    edge:      f.edge,
  }))
}
