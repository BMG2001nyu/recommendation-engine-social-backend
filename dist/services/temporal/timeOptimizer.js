"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scoreTimeSlot = scoreTimeSlot;
exports.suggestBestTimeSlot = suggestBestTimeSlot;
const graphTraversal_1 = require("../propagation/graphTraversal");
const busynessModel_1 = require("./busynessModel");
const availabilityModel_1 = require("./availabilityModel");
function nextWeekendDays(fromDate) {
    const results = [];
    const d = new Date(fromDate);
    d.setHours(0, 0, 0, 0);
    // Scan next 14 days for Fri (5), Sat (6)
    for (let i = 1; i <= 14 && results.length < 4; i++) {
        const candidate = new Date(d);
        candidate.setDate(d.getDate() + i);
        const dow = candidate.getDay();
        if (dow === 5 || dow === 6)
            results.push(candidate);
    }
    return results;
}
function buildCandidates(userId) {
    const now = new Date();
    const eveningHours = [18, 19, 20, 21, 22, 23];
    const candidates = [];
    // Weekend evenings (next 2 weekends)
    for (const day of nextWeekendDays(now)) {
        for (const h of eveningHours) {
            candidates.push({ date: day, dayOfWeek: day.getDay(), hour: h });
        }
    }
    // Wed (3) / Thu (4) evenings for the next 2 weeks
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    for (let i = 1; i <= 14; i++) {
        const candidate = new Date(d);
        candidate.setDate(d.getDate() + i);
        const dow = candidate.getDay();
        if (dow === 3 || dow === 4) {
            for (const h of eveningHours) {
                candidates.push({ date: candidate, dayOfWeek: dow, hour: h });
            }
        }
    }
    return candidates;
}
// ─── Score a single slot ──────────────────────────────────────────────────────
function scoreTimeSlot(userId, friendIds, venue, dayOfWeek, hour) {
    // Use a representative date with this day/hour
    const date = new Date();
    date.setHours(hour, 0, 0, 0);
    const friendAvailScore = (0, availabilityModel_1.getFriendAvailability)(friendIds, { dayOfWeek, hour });
    const busyness = (0, busynessModel_1.getBusynessAt)(venue, date);
    const busynessScore = (0, busynessModel_1.sweetSpotScore)(busyness);
    const preferredSlots = (0, availabilityModel_1.getPreferredSlots)(userId);
    const matchingSlot = preferredSlots.find(s => s.dayOfWeek === dayOfWeek && s.hour === hour);
    const habitScore = matchingSlot?.score ?? 0;
    return 0.50 * friendAvailScore + 0.30 * busynessScore + 0.20 * habitScore;
}
// ─── Best time slot suggestion ────────────────────────────────────────────────
function suggestBestTimeSlot(userId, venue) {
    const friends = (0, graphTraversal_1.getFriends)(userId);
    const friendIds = friends.map(f => f.id);
    const candidates = buildCandidates(userId);
    // Default fallback: next Friday at 20:00
    const fallbackDate = nextWeekendDays(new Date()).find(d => d.getDay() === 5) ?? new Date();
    fallbackDate.setHours(20, 0, 0, 0);
    if (candidates.length === 0) {
        return buildTimeSlot(fallbackDate, 20, 0, 0, 0, venue, friendIds.length);
    }
    let bestSlot = candidates[0];
    let bestScore = -1;
    for (const slot of candidates) {
        const score = scoreTimeSlot(userId, friendIds, venue, slot.dayOfWeek, slot.hour);
        if (score > bestScore) {
            bestScore = score;
            bestSlot = slot;
        }
    }
    const friendAvailScore = (0, availabilityModel_1.getFriendAvailability)(friendIds, {
        dayOfWeek: bestSlot.dayOfWeek,
        hour: bestSlot.hour,
    });
    const busynessLevel = (0, busynessModel_1.getBusynessAt)(venue, bestSlot.date);
    const availableFriendCount = Math.round(friendAvailScore * friendIds.length);
    return buildTimeSlot(bestSlot.date, bestSlot.hour, bestScore, busynessLevel, availableFriendCount, venue, friendIds.length);
}
function buildTimeSlot(date, hour, confidence, busynessLevel, availableFriendCount, venue, totalFriends) {
    const start = new Date(date);
    start.setHours(hour, 0, 0, 0);
    const end = new Date(start);
    end.setHours(hour + 2);
    const dowNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = dowNames[start.getDay()];
    const reasoning = `${dayName} at ${hour}:00 — ${venue.name} is at ${busynessLevel}% capacity ` +
        `(sweet spot: ~60%). ${availableFriendCount} of your ${totalFriends} friends are available.`;
    return {
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        confidence: Math.min(1, Math.max(0, confidence)),
        reasoning,
        availableFriendCount,
        busynessLevel,
    };
}
//# sourceMappingURL=timeOptimizer.js.map