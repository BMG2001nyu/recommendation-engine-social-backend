"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.propagateEngagement = propagateEngagement;
exports.consumePropagationSignals = consumePropagationSignals;
exports.cleanExpiredSignals = cleanExpiredSignals;
const uuid_1 = require("uuid");
const database_1 = require("../../db/database");
const graphTraversal_1 = require("./graphTraversal");
// ─── Constants ────────────────────────────────────────────────────────────────
const LEVEL_WEIGHTS = {
    viewed: 0.1,
    interested: 0.4,
    planning: 0.6,
    confirmed: 0.9,
    attended: 1.0,
};
const SIGNAL_TTL_DAYS = 7;
const MUTUAL_DAMPENING = 0.3;
// ─── Propagate engagement to the social graph ─────────────────────────────────
function propagateEngagement(userId, venueId, level) {
    const db = (0, database_1.getDb)();
    const levelWeight = LEVEL_WEIGHTS[level];
    const expiresAt = new Date(Date.now() + SIGNAL_TTL_DAYS * 86400000).toISOString();
    const notifiedUserIds = [];
    const signalStrengths = {};
    const insertStmt = db.prepare(`
    INSERT OR REPLACE INTO propagation_signals
      (id, source_user_id, target_user_id, venue_id, signal_strength, source_level, expires_at, consumed)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0)
  `);
    // Depth-1: direct friends, sorted by initiator_score descending
    const friends = (0, graphTraversal_1.getFriends)(userId).sort((a, b) => b.edge.initiatorScore - a.edge.initiatorScore);
    const propagate = db.transaction(() => {
        for (const friend of friends) {
            const strength = levelWeight * friend.edge.strength;
            insertStmt.run((0, uuid_1.v4)(), userId, friend.id, venueId, strength, level, expiresAt);
            notifiedUserIds.push(friend.id);
            signalStrengths[friend.id] = strength;
        }
        // Depth-2: mutuals with reduced strength
        const mutuals = (0, graphTraversal_1.getMutuals)(userId);
        for (const mutual of mutuals) {
            // Average strength of paths through shared friends (simplified: use MUTUAL_DAMPENING flat)
            const strength = levelWeight * MUTUAL_DAMPENING;
            insertStmt.run((0, uuid_1.v4)(), userId, mutual.id, venueId, strength, level, expiresAt);
            if (!signalStrengths[mutual.id]) {
                notifiedUserIds.push(mutual.id);
                signalStrengths[mutual.id] = strength;
            }
        }
    });
    propagate();
    return { notifiedUserIds, signalStrengths };
}
// ─── Consume signals ──────────────────────────────────────────────────────────
/**
 * Sum all unexpired, unconsumed signals for targetUserId + venueId,
 * mark them consumed, and return the total boost score.
 */
function consumePropagationSignals(targetUserId, venueId) {
    const db = (0, database_1.getDb)();
    const now = new Date().toISOString();
    const rows = db.prepare(`
    SELECT id, signal_strength FROM propagation_signals
    WHERE target_user_id = ?
      AND venue_id = ?
      AND consumed = 0
      AND expires_at > ?
  `).all(targetUserId, venueId, now);
    if (rows.length === 0)
        return 0;
    const total = rows.reduce((acc, r) => acc + r.signal_strength, 0);
    const ids = rows.map(r => r.id);
    const placeholders = ids.map(() => '?').join(',');
    db.prepare(`
    UPDATE propagation_signals SET consumed = 1 WHERE id IN (${placeholders})
  `).run(...ids);
    return total;
}
// ─── Cleanup ──────────────────────────────────────────────────────────────────
function cleanExpiredSignals() {
    const db = (0, database_1.getDb)();
    const now = new Date().toISOString();
    db.prepare(`
    DELETE FROM propagation_signals WHERE expires_at < ? OR consumed = 1
  `).run(now);
}
//# sourceMappingURL=signalPropagator.js.map