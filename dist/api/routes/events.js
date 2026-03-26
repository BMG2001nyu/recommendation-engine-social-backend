"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const eventBus_1 = require("../../events/eventBus");
const validate_1 = require("../middleware/validate");
const router = (0, express_1.Router)();
const eventSchema = zod_1.z.object({
    userId: zod_1.z.string(),
    type: zod_1.z.enum([
        'feed_view',
        'venue_view',
        'interest_expressed',
        'interest_withdrawn',
        'plan_created',
        'invite_sent',
        'invite_accepted',
        'invite_declined',
        'plan_confirmed',
        'booking_initiated',
        'booking_completed',
    ]),
    venueId: zod_1.z.string().optional(),
    planId: zod_1.z.string().optional(),
    metadata: zod_1.z.record(zod_1.z.unknown()).optional(),
});
router.post('/', (0, validate_1.validateBody)(eventSchema), async (req, res, next) => {
    try {
        const { userId, type, venueId, planId, metadata } = req.body;
        await eventBus_1.eventBus.publish(type, userId, { venueId, planId, metadata });
        res.status(202).json({ accepted: true });
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
//# sourceMappingURL=events.js.map