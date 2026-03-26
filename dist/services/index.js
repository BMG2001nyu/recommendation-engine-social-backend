"use strict";
/**
 * Top-level services barrel.
 * Provides CRUD helpers used by the API layer and re-exports all sub-services.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initiateBooking = void 0;
exports.getVenue = getVenue;
exports.getVenueWithSocialProof = getVenueWithSocialProof;
exports.expressInterest = expressInterest;
exports.getUserEngagements = getUserEngagements;
exports.getVenueEngagements = getVenueEngagements;
exports.createPlan = createPlan;
exports.getPlan = getPlan;
exports.getUserPlans = getUserPlans;
exports.sendInvites = sendInvites;
exports.respondToInvite = respondToInvite;
exports.getUserInvitations = getUserInvitations;
exports.getUser = getUser;
exports.getUserFriends = getUserFriends;
const uuid_1 = require("uuid");
const types_1 = require("../types");
const database_1 = require("../db/database");
const eventBus_1 = require("../events/eventBus");
const venueScorer_1 = require("./curation/venueScorer");
const signalPropagator_1 = require("./propagation/signalPropagator");
const graphTraversal_1 = require("./propagation/graphTraversal");
const engine_1 = require("./recommendation/engine");
// ─── Re-exports ───────────────────────────────────────────────────────────────
__exportStar(require("./curation"), exports);
__exportStar(require("./recommendation"), exports);
__exportStar(require("./propagation"), exports);
__exportStar(require("./temporal"), exports);
var bookingAgent_1 = require("./agent/bookingAgent");
Object.defineProperty(exports, "initiateBooking", { enumerable: true, get: function () { return bookingAgent_1.initiateBooking; } });
// ─── Row converters ───────────────────────────────────────────────────────────
function rowToUser(row) {
    return {
        id: row.id,
        name: row.name,
        email: row.email,
        lat: row.lat,
        lng: row.lng,
        city: row.city,
        createdAt: row.created_at,
    };
}
function rowToPlan(row) {
    return {
        id: row.id,
        venueId: row.venue_id,
        createdBy: row.created_by,
        scheduledTime: row.scheduled_time,
        status: row.status,
        bookingReference: row.booking_reference ?? undefined,
        bookingDetails: row.booking_details ? JSON.parse(row.booking_details) : undefined,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}
function rowToParticipant(row) {
    return {
        planId: row.plan_id,
        userId: row.user_id,
        status: row.status,
        invitedBy: row.invited_by,
        respondedAt: row.responded_at ?? undefined,
        createdAt: row.created_at,
    };
}
// ─── Plan assembly ────────────────────────────────────────────────────────────
function assemblePlanWithDetails(planRow) {
    const db = (0, database_1.getDb)();
    const venueRow = db.prepare('SELECT * FROM venues WHERE id = ?').get(planRow.venue_id);
    if (!venueRow)
        return null;
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
  `).all(planRow.id);
    const participants = participantRows.map(r => ({
        ...rowToParticipant(r),
        user: {
            id: r.u_id,
            name: r.u_name,
            email: r.u_email,
            lat: r.u_lat,
            lng: r.u_lng,
            city: r.u_city,
            createdAt: r.u_created,
        },
    }));
    return {
        ...rowToPlan(planRow),
        venue: (0, venueScorer_1.rowToVenue)(venueRow),
        participants,
    };
}
// ─── Venue helpers ────────────────────────────────────────────────────────────
function getVenue(venueId) {
    const db = (0, database_1.getDb)();
    const row = db.prepare('SELECT * FROM venues WHERE id = ?').get(venueId);
    return row ? (0, venueScorer_1.rowToVenue)(row) : null;
}
function getVenueWithSocialProof(venueId, userId) {
    const venue = getVenue(venueId);
    if (!venue)
        return null;
    return { ...venue, socialProof: (0, engine_1.getSocialProofForVenue)(venueId, userId) };
}
// ─── Engagement helpers ───────────────────────────────────────────────────────
function expressInterest(userId, venueId, level) {
    const db = (0, database_1.getDb)();
    const now = new Date().toISOString();
    const existing = db.prepare('SELECT * FROM venue_engagements WHERE user_id = ? AND venue_id = ?').get(userId, venueId);
    if (existing) {
        if (types_1.INTEREST_LEVEL_ORDER[level] <= types_1.INTEREST_LEVEL_ORDER[existing.level]) {
            return {
                id: existing.id,
                userId: existing.user_id,
                venueId: existing.venue_id,
                level: existing.level,
                createdAt: existing.created_at,
                updatedAt: existing.updated_at,
            };
        }
        db.prepare(`
      UPDATE venue_engagements SET level = ?, updated_at = ? WHERE id = ?
    `).run(level, now, existing.id);
        void (0, signalPropagator_1.propagateEngagement)(userId, venueId, level);
        void eventBus_1.eventBus.publish('interest_expressed', userId, { venueId, metadata: { level } });
        return {
            id: existing.id,
            userId,
            venueId,
            level,
            createdAt: existing.created_at,
            updatedAt: now,
        };
    }
    const id = (0, uuid_1.v4)();
    db.prepare(`
    INSERT INTO venue_engagements (id, user_id, venue_id, level, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, userId, venueId, level, now, now);
    db.prepare('UPDATE venues SET engagement_count = engagement_count + 1 WHERE id = ?').run(venueId);
    void (0, signalPropagator_1.propagateEngagement)(userId, venueId, level);
    void eventBus_1.eventBus.publish('interest_expressed', userId, { venueId, metadata: { level } });
    return { id, userId, venueId, level, createdAt: now, updatedAt: now };
}
function getUserEngagements(userId) {
    const db = (0, database_1.getDb)();
    const rows = db.prepare('SELECT * FROM venue_engagements WHERE user_id = ?').all(userId);
    return rows.map(r => ({
        id: r.id,
        userId: r.user_id,
        venueId: r.venue_id,
        level: r.level,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
    }));
}
function getVenueEngagements(venueId) {
    const db = (0, database_1.getDb)();
    const rows = db.prepare('SELECT * FROM venue_engagements WHERE venue_id = ?').all(venueId);
    return rows.map(r => ({
        id: r.id,
        userId: r.user_id,
        venueId: r.venue_id,
        level: r.level,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
    }));
}
// ─── Plan helpers ─────────────────────────────────────────────────────────────
function createPlan(req) {
    const db = (0, database_1.getDb)();
    const now = new Date().toISOString();
    const id = (0, uuid_1.v4)();
    db.prepare(`
    INSERT INTO plans (id, venue_id, created_by, scheduled_time, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'open', ?, ?)
  `).run(id, req.venueId, req.createdBy, req.scheduledTime, now, now);
    db.prepare(`
    INSERT INTO plan_participants (plan_id, user_id, status, invited_by, created_at)
    VALUES (?, ?, 'accepted', ?, ?)
  `).run(id, req.createdBy, req.createdBy, now);
    if (req.inviteeIds && req.inviteeIds.length > 0) {
        const stmt = db.prepare(`
      INSERT OR IGNORE INTO plan_participants (plan_id, user_id, status, invited_by, created_at)
      VALUES (?, ?, 'invited', ?, ?)
    `);
        for (const uid of req.inviteeIds)
            stmt.run(id, uid, req.createdBy, now);
    }
    void eventBus_1.eventBus.publish('plan_created', req.createdBy, {
        planId: id, venueId: req.venueId, metadata: {},
    });
    const planRow = db.prepare('SELECT * FROM plans WHERE id = ?').get(id);
    const result = assemblePlanWithDetails(planRow);
    if (!result)
        throw new Error(`Failed to assemble plan ${id}`);
    return result;
}
function getPlan(planId) {
    const db = (0, database_1.getDb)();
    const planRow = db.prepare('SELECT * FROM plans WHERE id = ?').get(planId);
    if (!planRow)
        return null;
    return assemblePlanWithDetails(planRow);
}
function getUserPlans(userId) {
    const db = (0, database_1.getDb)();
    const rows = db.prepare('SELECT * FROM plans WHERE created_by = ? ORDER BY created_at DESC').all(userId);
    return rows.flatMap(r => {
        const p = assemblePlanWithDetails(r);
        return p ? [p] : [];
    });
}
function sendInvites(planId, userIds, invitedBy) {
    const db = (0, database_1.getDb)();
    const now = new Date().toISOString();
    const stmt = db.prepare(`
    INSERT OR IGNORE INTO plan_participants (plan_id, user_id, status, invited_by, created_at)
    VALUES (?, ?, 'invited', ?, ?)
  `);
    for (const uid of userIds) {
        stmt.run(planId, uid, invitedBy, now);
        void eventBus_1.eventBus.publish('invite_sent', invitedBy, { planId, metadata: { inviteeId: uid } });
    }
    const ph = userIds.map(() => '?').join(',');
    const rows = db.prepare(`SELECT * FROM plan_participants WHERE plan_id = ? AND user_id IN (${ph})`).all(planId, ...userIds);
    return rows.map(rowToParticipant);
}
function respondToInvite(planId, userId, response) {
    const db = (0, database_1.getDb)();
    const now = new Date().toISOString();
    db.prepare(`
    UPDATE plan_participants SET status = ?, responded_at = ? WHERE plan_id = ? AND user_id = ?
  `).run(response, now, planId, userId);
    const evtType = response === 'accepted'
        ? 'invite_accepted'
        : response === 'declined'
            ? 'invite_declined'
            : 'invite_accepted';
    void eventBus_1.eventBus.publish(evtType, userId, { planId, metadata: { response } });
    // Auto-confirm when no more pending invites
    const allRows = db.prepare('SELECT status FROM plan_participants WHERE plan_id = ?').all(planId);
    const pending = allRows.filter(p => p.status === 'invited').length;
    const accepted = allRows.filter(p => p.status === 'accepted').length;
    if (pending === 0 && accepted > 0) {
        db.prepare(`UPDATE plans SET status = 'confirmed', updated_at = ? WHERE id = ?`).run(now, planId);
        void eventBus_1.eventBus.publish('plan_confirmed', userId, { planId, metadata: {} });
    }
    const row = db.prepare('SELECT * FROM plan_participants WHERE plan_id = ? AND user_id = ?').get(planId, userId);
    return rowToParticipant(row);
}
function getUserInvitations(userId) {
    const db = (0, database_1.getDb)();
    const rows = db.prepare(`
    SELECT p.*
    FROM plans p
    JOIN plan_participants pp ON pp.plan_id = p.id
    WHERE pp.user_id = ? AND pp.invited_by != ?
    ORDER BY p.created_at DESC
  `).all(userId, userId);
    return rows.flatMap(r => {
        const p = assemblePlanWithDetails(r);
        return p ? [p] : [];
    });
}
// ─── User helpers ─────────────────────────────────────────────────────────────
function getUser(userId) {
    const db = (0, database_1.getDb)();
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    return row ? rowToUser(row) : null;
}
function getUserFriends(userId) {
    return (0, graphTraversal_1.getFriends)(userId).map(f => ({
        id: f.id,
        name: f.name,
        email: f.email,
        lat: f.lat,
        lng: f.lng,
        city: f.city,
        createdAt: f.createdAt,
        edge: f.edge,
    }));
}
//# sourceMappingURL=index.js.map