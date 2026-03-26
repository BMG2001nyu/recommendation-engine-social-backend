import { v4 as uuidv4 } from 'uuid'
import type { InterestLevel, PropagationResult } from '../../types'
import { getDb } from '../../db/database'
import { getFriends, getMutuals } from './graphTraversal'

// ─── Constants ────────────────────────────────────────────────────────────────

const LEVEL_WEIGHTS: Record<InterestLevel, number> = {
  viewed:    0.1,
  interested: 0.4,
  planning:  0.6,
  confirmed: 0.9,
  attended:  1.0,
}

const SIGNAL_TTL_DAYS = 7
const MUTUAL_DAMPENING = 0.3

// ─── Propagate engagement to the social graph ─────────────────────────────────

export function propagateEngagement(
  userId: string,
  venueId: string,
  level: InterestLevel
): PropagationResult {
  const db = getDb()
  const levelWeight = LEVEL_WEIGHTS[level]
  const expiresAt = new Date(Date.now() + SIGNAL_TTL_DAYS * 86_400_000).toISOString()

  const notifiedUserIds: string[] = []
  const signalStrengths: Record<string, number> = {}

  const insertStmt = db.prepare(`
    INSERT OR REPLACE INTO propagation_signals
      (id, source_user_id, target_user_id, venue_id, signal_strength, source_level, expires_at, consumed)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0)
  `)

  // Depth-1: direct friends, sorted by initiator_score descending
  const friends = getFriends(userId).sort(
    (a, b) => b.edge.initiatorScore - a.edge.initiatorScore
  )

  const propagate = db.transaction(() => {
    for (const friend of friends) {
      const strength = levelWeight * friend.edge.strength
      insertStmt.run(uuidv4(), userId, friend.id, venueId, strength, level, expiresAt)
      notifiedUserIds.push(friend.id)
      signalStrengths[friend.id] = strength
    }

    // Depth-2: mutuals with reduced strength
    const mutuals = getMutuals(userId)
    for (const mutual of mutuals) {
      // Average strength of paths through shared friends (simplified: use MUTUAL_DAMPENING flat)
      const strength = levelWeight * MUTUAL_DAMPENING
      insertStmt.run(uuidv4(), userId, mutual.id, venueId, strength, level, expiresAt)
      if (!signalStrengths[mutual.id]) {
        notifiedUserIds.push(mutual.id)
        signalStrengths[mutual.id] = strength
      }
    }
  })

  propagate()

  return { notifiedUserIds, signalStrengths }
}

// ─── Consume signals ──────────────────────────────────────────────────────────

/**
 * Sum all unexpired, unconsumed signals for targetUserId + venueId,
 * mark them consumed, and return the total boost score.
 */
export function consumePropagationSignals(targetUserId: string, venueId: string): number {
  const db = getDb()
  const now = new Date().toISOString()

  const rows = db.prepare(`
    SELECT id, signal_strength FROM propagation_signals
    WHERE target_user_id = ?
      AND venue_id = ?
      AND consumed = 0
      AND expires_at > ?
  `).all(targetUserId, venueId, now) as Array<{ id: string; signal_strength: number }>

  if (rows.length === 0) return 0

  const total = rows.reduce((acc, r) => acc + r.signal_strength, 0)

  const ids = rows.map(r => r.id)
  const placeholders = ids.map(() => '?').join(',')
  db.prepare(`
    UPDATE propagation_signals SET consumed = 1 WHERE id IN (${placeholders})
  `).run(...ids)

  return total
}

// ─── Cleanup ──────────────────────────────────────────────────────────────────

export function cleanExpiredSignals(): void {
  const db = getDb()
  const now = new Date().toISOString()
  db.prepare(`
    DELETE FROM propagation_signals WHERE expires_at < ? OR consumed = 1
  `).run(now)
}
