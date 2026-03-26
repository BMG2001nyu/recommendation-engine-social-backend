"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTopTrendingVenues = getTopTrendingVenues;
exports.getEditorialPicks = getEditorialPicks;
const database_1 = require("../../db/database");
const venueScorer_1 = require("./venueScorer");
/**
 * Return the top N venues in a city ordered by freshly-computed trending score.
 * We re-compute on each call so the scores reflect the latest engagement
 * velocity without requiring a background job.
 */
function getTopTrendingVenues(city, limit = 10) {
    const db = (0, database_1.getDb)();
    const rows = db.prepare('SELECT * FROM venues WHERE city = ?').all(city);
    const scored = rows.map(row => ({
        row,
        trendingScore: (0, venueScorer_1.computeTrendingScore)(row.id),
    }));
    scored.sort((a, b) => b.trendingScore - a.trendingScore);
    return scored.slice(0, limit).map(({ row, trendingScore }) => {
        const venue = (0, venueScorer_1.rowToVenue)(row);
        venue.trendingScore = trendingScore;
        return venue;
    });
}
/**
 * Return high-quality, well-engaged venues suitable for cold-start recommendations.
 * Criteria: quality_score > 0.85 AND engagement_count > 100, sorted by quality_score desc.
 */
function getEditorialPicks(city, limit = 10) {
    const db = (0, database_1.getDb)();
    const rows = db.prepare(`
    SELECT * FROM venues
    WHERE city = ?
      AND quality_score > 0.85
      AND engagement_count > 100
    ORDER BY quality_score DESC
    LIMIT ?
  `).all(city, limit);
    return rows.map(venueScorer_1.rowToVenue);
}
//# sourceMappingURL=trendingDetector.js.map