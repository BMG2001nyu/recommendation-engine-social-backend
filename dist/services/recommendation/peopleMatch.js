"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.suggestPeopleForVenue = suggestPeopleForVenue;
const database_1 = require("../../db/database");
const graphTraversal_1 = require("../propagation/graphTraversal");
const interestProfile_1 = require("./interestProfile");
const venueUserMatcher_1 = require("./venueUserMatcher");
const availabilityModel_1 = require("../temporal/availabilityModel");
const timeOptimizer_1 = require("../temporal/timeOptimizer");
function getVenueEngagementLevel(userId, venueId) {
    const db = (0, database_1.getDb)();
    const row = db.prepare(`
    SELECT level FROM venue_engagements WHERE user_id = ? AND venue_id = ?
  `).get(userId, venueId);
    return row?.level ?? null;
}
function computeSharedInterests(sourceCategories, targetCategories) {
    const shared = [];
    let intersection = 0;
    let union = new Set([...sourceCategories, ...targetCategories]).size;
    for (const cat of sourceCategories) {
        if (targetCategories.has(cat)) {
            intersection++;
            shared.push(cat);
        }
    }
    const score = union === 0 ? 0 : intersection / union;
    return { score, shared };
}
// ─── Main export ──────────────────────────────────────────────────────────────
function suggestPeopleForVenue(userId, venue, limit = 3) {
    const userProfile = (0, interestProfile_1.buildInterestProfile)(userId);
    const userCategories = new Set(userProfile.weightedInterests.map(w => w.category.toLowerCase()));
    // Derive a representative time slot to check availability
    const bestSlot = (0, timeOptimizer_1.suggestBestTimeSlot)(userId, venue);
    const slotDate = new Date(bestSlot.startTime);
    const timeSlot = { dayOfWeek: slotDate.getDay(), hour: slotDate.getHours() };
    const candidates = [];
    // Direct friends
    const friends = (0, graphTraversal_1.getFriends)(userId);
    for (const friend of friends) {
        const friendProfile = (0, interestProfile_1.buildInterestProfile)(friend.id);
        const friendCats = new Set(friendProfile.weightedInterests.map(w => w.category.toLowerCase()));
        const { score: sharedInterestScore, shared: sharedInterests } = computeSharedInterests(userCategories, friendCats);
        const venueCompatibilityScore = (0, venueUserMatcher_1.scoreVenueForUser)(venue, friendProfile);
        const availabilityScore = (0, availabilityModel_1.getFriendAvailability)([friend.id], timeSlot);
        const engagementLevel = getVenueEngagementLevel(friend.id, venue.id);
        const hasExpressedInterest = engagementLevel !== null && engagementLevel !== 'viewed';
        candidates.push({
            userId: friend.id,
            name: friend.name,
            reason: 'friend',
            socialProximity: friend.edge.strength,
            sharedInterestScore,
            venueCompatibilityScore,
            availabilityScore,
            hasExpressedInterest,
            sharedInterests,
        });
    }
    // Mutual friends (depth-2)
    const directFriendIds = new Set(friends.map(f => f.id));
    const mutuals = (0, graphTraversal_1.getMutuals)(userId);
    for (const mutual of mutuals) {
        if (directFriendIds.has(mutual.id))
            continue;
        const mutualProfile = (0, interestProfile_1.buildInterestProfile)(mutual.id);
        const mutualCats = new Set(mutualProfile.weightedInterests.map(w => w.category.toLowerCase()));
        const { score: sharedInterestScore, shared: sharedInterests } = computeSharedInterests(userCategories, mutualCats);
        const venueCompatibilityScore = (0, venueUserMatcher_1.scoreVenueForUser)(venue, mutualProfile);
        const availabilityScore = (0, availabilityModel_1.getFriendAvailability)([mutual.id], timeSlot);
        const engagementLevel = getVenueEngagementLevel(mutual.id, venue.id);
        const hasExpressedInterest = engagementLevel !== null && engagementLevel !== 'viewed';
        candidates.push({
            userId: mutual.id,
            name: mutual.name,
            reason: 'mutual',
            socialProximity: 0.5,
            sharedInterestScore,
            venueCompatibilityScore,
            availabilityScore,
            hasExpressedInterest,
            sharedInterests,
        });
    }
    // Score and sort
    const scored = candidates.map(c => {
        const personScore = 0.35 * c.sharedInterestScore +
            0.30 * c.socialProximity +
            0.20 * c.venueCompatibilityScore +
            0.15 * c.availabilityScore;
        return { ...c, compatibilityScore: personScore };
    });
    scored.sort((a, b) => b.compatibilityScore - a.compatibilityScore);
    return scored.slice(0, limit).map(c => ({
        userId: c.userId,
        name: c.name,
        reason: c.reason,
        compatibilityScore: c.compatibilityScore,
        hasExpressedInterest: c.hasExpressedInterest,
        sharedInterests: c.sharedInterests,
    }));
}
//# sourceMappingURL=peopleMatch.js.map