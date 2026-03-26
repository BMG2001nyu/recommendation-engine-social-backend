"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const services_1 = require("../../services");
const errorHandler_1 = require("../middleware/errorHandler");
const validate_1 = require("../middleware/validate");
const router = (0, express_1.Router)();
const expressInterestSchema = zod_1.z.object({
    userId: zod_1.z.string().min(1),
    venueId: zod_1.z.string(),
    level: zod_1.z.enum(['viewed', 'interested', 'planning', 'confirmed', 'attended']),
});
router.post('/', (0, validate_1.validateBody)(expressInterestSchema), async (req, res, next) => {
    try {
        const { userId, venueId, level } = req.body;
        const engagement = await (0, services_1.expressInterest)(userId, venueId, level);
        res.status(201).json(engagement);
    }
    catch (err) {
        next(err);
    }
});
router.get('/venue/:venueId', async (req, res, next) => {
    try {
        const { venueId } = req.params;
        const engagements = await (0, services_1.getVenueEngagements)(venueId);
        res.json({ engagements, count: engagements.length });
    }
    catch (err) {
        next(err);
    }
});
router.get('/:userId', async (req, res, next) => {
    try {
        const { userId } = req.params;
        const engagements = await (0, services_1.getUserEngagements)(userId);
        if (!engagements)
            throw new errorHandler_1.AppError(404, 'User not found');
        res.json({ engagements, count: engagements.length });
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
//# sourceMappingURL=interests.js.map