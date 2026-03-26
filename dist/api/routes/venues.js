"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const services_1 = require("../../services");
const database_1 = require("../../db/database");
const errorHandler_1 = require("../middleware/errorHandler");
const validate_1 = require("../middleware/validate");
const router = (0, express_1.Router)();
const venueQuerySchema = zod_1.z.object({
    userId: zod_1.z.string().optional(),
});
const listQuerySchema = zod_1.z.object({
    city: zod_1.z.string().optional(),
    category: zod_1.z.string().optional(),
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(20),
    offset: zod_1.z.coerce.number().int().min(0).default(0),
});
function rowToVenue(row) {
    return {
        id: row.id,
        name: row.name,
        category: row.category,
        tags: JSON.parse(row.tags || '[]'),
        lat: row.lat,
        lng: row.lng,
        address: row.address,
        city: row.city,
        rating: row.rating,
        priceLevel: row.price_level,
        busynessPattern: JSON.parse(row.busyness_pattern || '[]'),
        photos: JSON.parse(row.photos || '[]'),
        vibeDescription: row.vibe_description,
        qualityScore: row.quality_score,
        trendingScore: row.trending_score,
        engagementCount: row.engagement_count,
        createdAt: row.created_at,
    };
}
function getAllVenues(opts) {
    const db = (0, database_1.getDb)();
    const conditions = [];
    const params = [];
    if (opts.city) {
        conditions.push('city = ?');
        params.push(opts.city);
    }
    if (opts.category) {
        conditions.push('category = ?');
        params.push(opts.category);
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const total = db.prepare(`SELECT COUNT(*) as count FROM venues ${where}`).get(...params).count;
    const rows = db.prepare(`SELECT * FROM venues ${where} LIMIT ? OFFSET ?`).all(...params, opts.limit, opts.offset);
    return { venues: rows.map(rowToVenue), total };
}
router.get('/', (0, validate_1.validateQuery)(listQuerySchema), async (req, res, next) => {
    try {
        const { city, category, limit, offset } = req.validatedQuery;
        const { venues, total } = getAllVenues({ city, category, limit, offset });
        res.json({ venues, total, limit, offset });
    }
    catch (err) {
        next(err);
    }
});
router.get('/:venueId', (0, validate_1.validateQuery)(venueQuerySchema), async (req, res, next) => {
    try {
        const { venueId } = req.params;
        const { userId } = req.validatedQuery;
        if (userId) {
            const result = await (0, services_1.getVenueWithSocialProof)(venueId, userId);
            if (!result)
                throw new errorHandler_1.AppError(404, 'Venue not found');
            res.json(result);
        }
        else {
            const venue = await (0, services_1.getVenue)(venueId);
            if (!venue)
                throw new errorHandler_1.AppError(404, 'Venue not found');
            res.json(venue);
        }
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
//# sourceMappingURL=venues.js.map