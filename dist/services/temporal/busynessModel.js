"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBusynessAt = getBusynessAt;
exports.sweetSpotScore = sweetSpotScore;
exports.findSweetSpotSlots = findSweetSpotSlots;
// ─── Busyness lookup ──────────────────────────────────────────────────────────
/**
 * Return the busyness level (0–100) for a venue at the given date/time.
 * Falls back to 50 when the pattern data is missing or malformed.
 */
function getBusynessAt(venue, date) {
    const pattern = venue.busynessPattern;
    if (!Array.isArray(pattern) || pattern.length === 0)
        return 50;
    const dayOfWeek = date.getDay(); // 0 = Sunday
    const hour = date.getHours(); // 0–23
    const day = pattern[dayOfWeek];
    if (!Array.isArray(day) || day.length === 0)
        return 50;
    const value = day[hour];
    return typeof value === 'number' ? Math.max(0, Math.min(100, value)) : 50;
}
// ─── Sweet-spot scoring ───────────────────────────────────────────────────────
/**
 * Gaussian peak at 60% busyness. Score ∈ (0, 1].
 *
 *   score = exp(-0.5 * ((busyness - 60) / 20)²)
 */
function sweetSpotScore(busyness) {
    const z = (busyness - 60) / 20;
    return Math.exp(-0.5 * z * z);
}
// ─── Find sweet-spot slots in an evening window ───────────────────────────────
/**
 * For the given date, evaluate hours [18, 23] (inclusive) and return them
 * sorted by sweetSpotScore descending.
 */
function findSweetSpotSlots(venue, date, windowHours = 6) {
    const startHour = 18;
    const endHour = Math.min(23, startHour + windowHours - 1);
    const slots = [];
    for (let h = startHour; h <= endHour; h++) {
        const d = new Date(date);
        d.setHours(h, 0, 0, 0);
        const busyness = getBusynessAt(venue, d);
        slots.push({ hour: h, score: sweetSpotScore(busyness) });
    }
    return slots.sort((a, b) => b.score - a.score);
}
//# sourceMappingURL=busynessModel.js.map