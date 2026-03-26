"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDistinctivenessMap = getDistinctivenessMap;
exports.buildInterestProfile = buildInterestProfile;
const database_1 = require("../../db/database");
// ─── Distinctiveness (IDF-style) ──────────────────────────────────────────────
/**
 * For each interest category across all users, compute an IDF-style
 * distinctiveness score.
 *
 * distinctiveness(c) = log(1 + totalUsers / max(1, usersWithCategory(c)))
 * Normalised so the maximum value becomes 1.
 */
function getDistinctivenessMap(allUserIds) {
    const db = (0, database_1.getDb)();
    const totalUsers = allUserIds.length;
    if (totalUsers === 0)
        return {};
    const rows = db.prepare(`
    SELECT category, COUNT(DISTINCT user_id) as cnt
    FROM interests
    GROUP BY category
  `).all();
    const raw = {};
    for (const { category, cnt } of rows) {
        raw[category] = Math.log(1 + totalUsers / Math.max(1, cnt));
    }
    const maxVal = Math.max(...Object.values(raw), 1);
    const normalised = {};
    for (const [cat, val] of Object.entries(raw)) {
        normalised[cat] = val / maxVal;
    }
    return normalised;
}
// ─── Behavior signals ─────────────────────────────────────────────────────────
function computeBehaviorSignals(userId) {
    const db = (0, database_1.getDb)();
    const events = db.prepare(`
    SELECT event_type, venue_id, timestamp
    FROM engagement_events
    WHERE user_id = ?
    ORDER BY timestamp ASC
  `).all(userId);
    const viewCount = events.filter(e => e.event_type === 'venue_view').length;
    const saveCount = events.filter(e => e.event_type === 'interest_expressed').length;
    const planCount = events.filter(e => e.event_type === 'plan_created').length;
    const saveRate = saveCount / Math.max(1, viewCount);
    const planConversionRate = planCount / Math.max(1, saveCount);
    // Day / hour preference: count events per (day, hour), pick top 3
    const dayCounts = {};
    const hourCounts = {};
    for (const e of events) {
        const d = new Date(e.timestamp);
        const day = d.getDay();
        const hour = d.getHours();
        dayCounts[day] = (dayCounts[day] ?? 0) + 1;
        hourCounts[hour] = (hourCounts[hour] ?? 0) + 1;
    }
    const preferredDays = Object.entries(dayCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([d]) => Number(d));
    const preferredHours = Object.entries(hourCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([h]) => Number(h));
    // Price preference: average price_level of venues the user engaged with
    const engagedVenueIds = [...new Set(events.filter(e => e.venue_id !== null).map(e => e.venue_id))];
    let pricePreference = 2; // default mid-range
    if (engagedVenueIds.length > 0) {
        const placeholders = engagedVenueIds.map(() => '?').join(',');
        const priceRows = db.prepare(`
      SELECT price_level FROM venues WHERE id IN (${placeholders})
    `).all(...engagedVenueIds);
        if (priceRows.length > 0) {
            pricePreference = priceRows.reduce((acc, r) => acc + r.price_level, 0) / priceRows.length;
        }
    }
    return {
        avgViewDuration: 0, // not tracked at DB level currently
        saveRate,
        shareRate: 0, // not tracked at DB level currently
        planConversionRate,
        preferredDays,
        preferredHours,
        pricePreference,
    };
}
// ─── Profile builder ──────────────────────────────────────────────────────────
function buildInterestProfile(userId) {
    const db = (0, database_1.getDb)();
    // Load all user IDs for distinctiveness computation
    const allUserIds = db.prepare('SELECT id FROM users').all()
        .map(r => r.id);
    const distinctivenessMap = getDistinctivenessMap(allUserIds);
    // Load this user's interests
    const interests = db.prepare(`
    SELECT * FROM interests WHERE user_id = ?
  `).all(userId);
    // Compute finalWeight = rawWeight * distinctiveness
    const rawWeighted = interests.map(i => ({
        category: i.category,
        rawWeight: i.weight,
        distinctiveness: distinctivenessMap[i.category] ?? 1,
        finalWeight: i.weight * (distinctivenessMap[i.category] ?? 1),
    }));
    // Normalise finalWeight so max = 1
    const maxFinal = Math.max(...rawWeighted.map(w => w.finalWeight), 1);
    const weightedInterests = rawWeighted.map(w => ({
        ...w,
        finalWeight: w.finalWeight / maxFinal,
    }));
    const behaviorSignals = computeBehaviorSignals(userId);
    return {
        userId,
        weightedInterests,
        distinctivenessMap,
        behaviorSignals,
        updatedAt: new Date().toISOString(),
    };
}
//# sourceMappingURL=interestProfile.js.map