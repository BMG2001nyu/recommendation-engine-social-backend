"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rankByInitiatorPotential = rankByInitiatorPotential;
exports.updateInitiatorScores = updateInitiatorScores;
const database_1 = require("../../db/database");
// ─── Rank users by their plan-initiation tendency ─────────────────────────────
function rankByInitiatorPotential(userIds) {
    if (userIds.length === 0)
        return [];
    const db = (0, database_1.getDb)();
    const scores = [];
    for (const uid of userIds) {
        const row = db.prepare(`
      SELECT AVG(initiator_score) as avg_score FROM social_edges WHERE user_id = ?
    `).get(uid);
        scores.push({ id: uid, score: row?.avg_score ?? 0.5 });
    }
    return scores.sort((a, b) => b.score - a.score).map(s => s.id);
}
// ─── Recalculate initiator scores from event history ─────────────────────────
/**
 * For each user, compute:
 *   initiatorScore = plan_created_count / max(1, total_engagement_count)
 *
 * Update social_edges.initiator_score for all edges where user_id = that user.
 */
function updateInitiatorScores() {
    const db = (0, database_1.getDb)();
    const userRows = db.prepare('SELECT id FROM users').all();
    const updateStmt = db.prepare(`
    UPDATE social_edges SET initiator_score = ? WHERE user_id = ?
  `);
    const update = db.transaction(() => {
        for (const { id } of userRows) {
            const planRow = db.prepare(`
        SELECT COUNT(*) as cnt FROM engagement_events
        WHERE user_id = ? AND event_type = 'plan_created'
      `).get(id);
            const totalRow = db.prepare(`
        SELECT COUNT(*) as cnt FROM engagement_events WHERE user_id = ?
      `).get(id);
            const planCount = planRow?.cnt ?? 0;
            const totalCount = totalRow?.cnt ?? 0;
            const score = planCount / Math.max(1, totalCount);
            updateStmt.run(score, id);
        }
    });
    update();
}
//# sourceMappingURL=initiatorDetector.js.map