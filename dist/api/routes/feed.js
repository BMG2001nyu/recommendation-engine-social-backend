"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const services_1 = require("../../services");
const eventBus_1 = require("../../events/eventBus");
const errorHandler_1 = require("../middleware/errorHandler");
const validate_1 = require("../middleware/validate");
const router = (0, express_1.Router)();
const feedQuerySchema = zod_1.z.object({
    limit: zod_1.z.coerce.number().int().min(1).max(50).default(10),
});
router.get('/:userId', (0, validate_1.validateQuery)(feedQuerySchema), async (req, res, next) => {
    try {
        const { userId } = req.params;
        const { limit } = req.validatedQuery;
        const user = await (0, services_1.getUser)(userId);
        if (!user)
            throw new errorHandler_1.AppError(404, 'User not found');
        const [recommendations, coldStartInfo] = await Promise.all([
            (0, services_1.generateFeed)(userId, limit),
            (0, services_1.detectColdStart)(userId),
        ]);
        await eventBus_1.eventBus.publish('feed_view', userId, {});
        const info = coldStartInfo;
        const strategy = info.isColdStart
            ? 'cold_start'
            : info.isHybrid
                ? 'hybrid'
                : 'personalized';
        const response = {
            recommendations,
            userId,
            generatedAt: new Date().toISOString(),
            strategy,
            count: recommendations.length,
        };
        res.json(response);
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
//# sourceMappingURL=feed.js.map