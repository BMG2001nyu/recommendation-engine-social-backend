"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectColdStart = detectColdStart;
exports.getSocialProofForVenue = getSocialProofForVenue;
exports.generateFeed = generateFeed;
const database_1 = require("../../db/database");
const venueScorer_1 = require("../curation/venueScorer");
const trendingDetector_1 = require("../curation/trendingDetector");
const interestProfile_1 = require("./interestProfile");
const venueUserMatcher_1 = require("./venueUserMatcher");
const peopleMatch_1 = require("./peopleMatch");
const timeOptimizer_1 = require("../temporal/timeOptimizer");
const graphTraversal_1 = require("../propagation/graphTraversal");
// ─── Cold-start detection ─────────────────────────────────────────────────────
function detectColdStart(userId) {
    const db = (0, database_1.getDb)();
    const row = db.prepare(`
    SELECT COUNT(DISTINCT id) as cnt FROM engagement_events WHERE user_id = ?
  `).get(userId);
    const count = row?.cnt ?? 0;
    return {
        isColdStart: count === 0,
        isHybrid: count > 0 && count < 5,
        engagementCount: count,
    };
}
// ─── Social proof ─────────────────────────────────────────────────────────────
function getSocialProofForVenue(venueId, userId) {
    const db = (0, database_1.getDb)();
    // Counts by level
    const levelRows = db.prepare(`
    SELECT level, COUNT(*) as cnt FROM venue_engagements WHERE venue_id = ? GROUP BY level
  `).all(venueId);
    const byLevel = {};
    for (const r of levelRows)
        byLevel[r.level] = r.cnt;
    const interestedCount = byLevel['interested'] ?? 0;
    const planningCount = (byLevel['planning'] ?? 0) + (byLevel['confirmed'] ?? 0);
    const confirmedCount = byLevel['confirmed'] ?? 0;
    const total = Object.values(byLevel).reduce((a, b) => a + b, 0);
    // Friends who have engaged
    const friends = (0, graphTraversal_1.getFriends)(userId);
    const friendIds = friends.map(f => f.id);
    const friendsInterested = [];
    const friendsConfirmed = [];
    if (friendIds.length > 0) {
        const placeholders = friendIds.map(() => '?').join(',');
        const friendEngRows = db.prepare(`
      SELECT ve.user_id, u.name, ve.level
      FROM venue_engagements ve
      JOIN users u ON u.id = ve.user_id
      WHERE ve.venue_id = ? AND ve.user_id IN (${placeholders})
    `).all(venueId, ...friendIds);
        for (const row of friendEngRows) {
            if (row.level === 'interested' || row.level === 'planning') {
                friendsInterested.push({ userId: row.user_id, name: row.name });
            }
            if (row.level === 'confirmed' || row.level === 'attended') {
                friendsConfirmed.push({ userId: row.user_id, name: row.name });
            }
        }
    }
    let momentumTrend = 'cold';
    if (total > 10)
        momentumTrend = 'peaking';
    else if (total >= 4)
        momentumTrend = 'hot';
    else if (total >= 1)
        momentumTrend = 'warming';
    return {
        interestedCount,
        planningCount,
        confirmedCount,
        friendsInterested,
        friendsConfirmed,
        momentumTrend,
    };
}
// ─── Core feed generation ─────────────────────────────────────────────────────
async function generateFeed(userId, limit = 10) {
    const db = (0, database_1.getDb)();
    const { isColdStart, engagementCount } = detectColdStart(userId);
    const userRow = db.prepare('SELECT id, city FROM users WHERE id = ?').get(userId);
    const city = userRow?.city ?? 'New York';
    // Attended venues to exclude
    const attendedRows = db.prepare(`
    SELECT venue_id FROM venue_engagements WHERE user_id = ? AND level = 'attended'
  `).all(userId);
    const attendedIds = new Set(attendedRows.map(r => r.venue_id));
    // ── Candidate generation ────────────────────────────────────────────────────
    let candidates = [];
    if (engagementCount === 0) {
        // Pure cold start: editorial + trending
        const editorial = (0, trendingDetector_1.getEditorialPicks)(city, 20);
        const trending = (0, trendingDetector_1.getTopTrendingVenues)(city, 20);
        candidates = deduplicateVenues([...editorial, ...trending]);
    }
    else if (engagementCount < 5) {
        // Hybrid: 70% trending + 30% personalized
        const trending = (0, trendingDetector_1.getTopTrendingVenues)(city, 30);
        const allRows = db.prepare('SELECT * FROM venues WHERE city = ?').all(city);
        const allVenues = allRows.map(venueScorer_1.rowToVenue);
        candidates = deduplicateVenues([...trending, ...allVenues]);
    }
    else {
        // Fully personalized
        const allRows = db.prepare('SELECT * FROM venues WHERE city = ?').all(city);
        candidates = allRows.map(venueScorer_1.rowToVenue);
    }
    // Exclude attended
    candidates = candidates.filter(v => !attendedIds.has(v.id));
    // ── Scoring ─────────────────────────────────────────────────────────────────
    const profile = isColdStart ? null : (0, interestProfile_1.buildInterestProfile)(userId);
    // Propagation signals for this user
    const now = new Date().toISOString();
    const signalRows = db.prepare(`
    SELECT venue_id, SUM(signal_strength) as signal_strength
    FROM propagation_signals
    WHERE target_user_id = ? AND consumed = 0 AND expires_at > ?
    GROUP BY venue_id
  `).all(userId, now);
    const signalMap = new Map(signalRows.map(r => [r.venue_id, r.signal_strength]));
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
    const scored = candidates.map(venue => {
        const venueMatch = profile ? (0, venueUserMatcher_1.scoreVenueForUser)(venue, profile) : venue.trendingScore;
        const socialScore = Math.min(1, signalMap.get(venue.id) ?? 0);
        const timeSlot = (0, timeOptimizer_1.suggestBestTimeSlot)(userId, venue);
        const temporalScore = timeSlot.confidence;
        const freshnessBonus = venue.createdAt >= thirtyDaysAgo ? 0.1 : 0;
        const overall = 0.40 * venueMatch +
            0.30 * socialScore +
            0.25 * temporalScore +
            0.05 * freshnessBonus;
        return { venue, venueMatch, socialScore, temporalScore, freshnessBonus, overall, timeSlot };
    });
    scored.sort((a, b) => b.overall - a.overall);
    const top = scored.slice(0, limit);
    // ── Build recommendations ───────────────────────────────────────────────────
    let strategy = 'personalized';
    if (engagementCount === 0)
        strategy = 'cold_start';
    else if (engagementCount < 5)
        strategy = 'hybrid';
    return top.map(({ venue, venueMatch, socialScore, temporalScore, freshnessBonus, overall, timeSlot }) => {
        const suggestedPeople = (0, peopleMatch_1.suggestPeopleForVenue)(userId, venue, 3);
        const socialProof = getSocialProofForVenue(venue.id, userId);
        let coldStartStrategy;
        if (strategy === 'cold_start') {
            coldStartStrategy = {
                approach: 'trending',
                confidence: venue.trendingScore,
                explanation: 'Recommended based on trending activity in your city.',
            };
        }
        else if (strategy === 'hybrid') {
            coldStartStrategy = {
                approach: 'predicted_social',
                confidence: 0.6,
                explanation: 'Blended personalisation with trending signals.',
            };
        }
        return {
            venue,
            suggestedPeople,
            suggestedTime: timeSlot,
            score: {
                venueMatch,
                socialScore,
                temporalScore,
                freshnessBonus,
                overall,
            },
            socialProof,
            coldStartStrategy,
        };
    });
}
// ─── Deduplication helper ─────────────────────────────────────────────────────
function deduplicateVenues(venues) {
    const seen = new Set();
    return venues.filter(v => {
        if (seen.has(v.id))
            return false;
        seen.add(v.id);
        return true;
    });
}
//# sourceMappingURL=engine.js.map