import { getDb } from '../../db/database'

// ─── Rank users by their plan-initiation tendency ─────────────────────────────

export function rankByInitiatorPotential(userIds: string[]): string[] {
  if (userIds.length === 0) return []

  const db = getDb()
  const scores: Array<{ id: string; score: number }> = []

  for (const uid of userIds) {
    const row = db.prepare(`
      SELECT AVG(initiator_score) as avg_score FROM social_edges WHERE user_id = ?
    `).get(uid) as { avg_score: number | null }
    scores.push({ id: uid, score: row?.avg_score ?? 0.5 })
  }

  return scores.sort((a, b) => b.score - a.score).map(s => s.id)
}

// ─── Recalculate initiator scores from event history ─────────────────────────

/**
 * For each user, compute:
 *   initiatorScore = plan_created_count / max(1, total_engagement_count)
 *
 * Update social_edges.initiator_score for all edges where user_id = that user.
 */
export function updateInitiatorScores(): void {
  const db = getDb()

  const userRows = db.prepare('SELECT id FROM users').all() as Array<{ id: string }>

  const updateStmt = db.prepare(`
    UPDATE social_edges SET initiator_score = ? WHERE user_id = ?
  `)

  const update = db.transaction(() => {
    for (const { id } of userRows) {
      const planRow = db.prepare(`
        SELECT COUNT(*) as cnt FROM engagement_events
        WHERE user_id = ? AND event_type = 'plan_created'
      `).get(id) as { cnt: number }

      const totalRow = db.prepare(`
        SELECT COUNT(*) as cnt FROM engagement_events WHERE user_id = ?
      `).get(id) as { cnt: number }

      const planCount  = planRow?.cnt ?? 0
      const totalCount = totalRow?.cnt ?? 0
      const score = planCount / Math.max(1, totalCount)

      updateStmt.run(score, id)
    }
  })

  update()
}
