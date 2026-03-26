import Database from 'better-sqlite3'
import { createTestDb, setDb, closeDb } from '../../src/db/database'
import {
  propagateEngagement,
  consumePropagationSignals,
} from '../../src/services/propagation/signalPropagator'
import {
  insertUser,
  insertVenue,
  insertSocialEdge,
} from '../helpers'

let db: Database.Database

beforeEach(() => {
  db = createTestDb()
  setDb(db)
})

afterEach(() => {
  closeDb()
})

describe('propagateEngagement', () => {
  it('creates propagation_signals for direct friends', () => {
    const user = insertUser(db)
    const friend = insertUser(db, { name: 'Direct Friend' })
    const venue = insertVenue(db)
    insertSocialEdge(db, user.id, friend.id, 0.8, 0.7)

    propagateEngagement(user.id, venue.id, 'interested')

    const signals = db.prepare(
      'SELECT * FROM propagation_signals WHERE source_user_id = ? AND venue_id = ?'
    ).all(user.id, venue.id) as Array<{ target_user_id: string; signal_strength: number }>

    expect(signals.length).toBeGreaterThan(0)
    const friendSignal = signals.find(s => s.target_user_id === friend.id)
    expect(friendSignal).toBeDefined()
  })

  it('signal strength is higher for "confirmed" than for "viewed"', () => {
    const user = insertUser(db)
    const friend = insertUser(db, { name: 'Close Friend' })
    const venue = insertVenue(db)
    insertSocialEdge(db, user.id, friend.id, 1.0, 0.5)

    propagateEngagement(user.id, venue.id, 'confirmed')
    const confirmedSignals = db.prepare(
      'SELECT signal_strength FROM propagation_signals WHERE source_user_id = ? AND target_user_id = ? AND venue_id = ?'
    ).all(user.id, friend.id, venue.id) as Array<{ signal_strength: number }>
    const confirmedStrength = confirmedSignals[0]?.signal_strength ?? 0

    // Clean up and re-insert with 'viewed' to compare
    db.prepare('DELETE FROM propagation_signals').run()
    propagateEngagement(user.id, venue.id, 'viewed')
    const viewedSignals = db.prepare(
      'SELECT signal_strength FROM propagation_signals WHERE source_user_id = ? AND target_user_id = ? AND venue_id = ?'
    ).all(user.id, friend.id, venue.id) as Array<{ signal_strength: number }>
    const viewedStrength = viewedSignals[0]?.signal_strength ?? 0

    expect(confirmedStrength).toBeGreaterThan(viewedStrength)
  })

  it('returns a notifiedUserIds list containing direct friends', () => {
    const user = insertUser(db)
    const friend1 = insertUser(db, { name: 'Friend One' })
    const friend2 = insertUser(db, { name: 'Friend Two' })
    const venue = insertVenue(db)
    insertSocialEdge(db, user.id, friend1.id, 0.8, 0.7)
    insertSocialEdge(db, user.id, friend2.id, 0.6, 0.5)

    const result = propagateEngagement(user.id, venue.id, 'planning')

    expect(result.notifiedUserIds).toContain(friend1.id)
    expect(result.notifiedUserIds).toContain(friend2.id)
  })
})

describe('consumePropagationSignals', () => {
  it('returns 0 when no signals exist for the target user and venue', () => {
    const user = insertUser(db)
    const venue = insertVenue(db)

    const total = consumePropagationSignals(user.id, venue.id)

    expect(total).toBe(0)
  })

  it('returns the sum of signal strengths for the target user and venue', () => {
    const sourceUser = insertUser(db)
    const targetUser = insertUser(db, { name: 'Target' })
    const venue = insertVenue(db)
    insertSocialEdge(db, sourceUser.id, targetUser.id, 0.8, 0.7)

    propagateEngagement(sourceUser.id, venue.id, 'interested')

    const total = consumePropagationSignals(targetUser.id, venue.id)

    expect(total).toBeGreaterThan(0)
  })

  it('marks signals as consumed after calling consumePropagationSignals', () => {
    const sourceUser = insertUser(db)
    const targetUser = insertUser(db, { name: 'Target' })
    const venue = insertVenue(db)
    insertSocialEdge(db, sourceUser.id, targetUser.id, 0.8, 0.7)

    propagateEngagement(sourceUser.id, venue.id, 'interested')
    consumePropagationSignals(targetUser.id, venue.id)

    const unconsumed = db.prepare(
      'SELECT COUNT(*) as cnt FROM propagation_signals WHERE target_user_id = ? AND venue_id = ? AND consumed = 0'
    ).get(targetUser.id, venue.id) as { cnt: number }

    expect(unconsumed.cnt).toBe(0)
  })

  it('returns 0 on a second call because signals are already consumed', () => {
    const sourceUser = insertUser(db)
    const targetUser = insertUser(db, { name: 'Target' })
    const venue = insertVenue(db)
    insertSocialEdge(db, sourceUser.id, targetUser.id, 0.8, 0.7)

    propagateEngagement(sourceUser.id, venue.id, 'interested')
    consumePropagationSignals(targetUser.id, venue.id)
    const secondCall = consumePropagationSignals(targetUser.id, venue.id)

    expect(secondCall).toBe(0)
  })
})
