"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const services_1 = require("../../services");
const bookingAgent_1 = require("../../services/agent/bookingAgent");
const errorHandler_1 = require("../middleware/errorHandler");
const validate_1 = require("../middleware/validate");
const router = (0, express_1.Router)();
const createPlanSchema = zod_1.z.object({
    venueId: zod_1.z.string(),
    createdBy: zod_1.z.string(),
    scheduledTime: zod_1.z.string().datetime(),
    inviteeIds: zod_1.z.array(zod_1.z.string()).optional(),
});
const sendInvitesSchema = zod_1.z.object({
    userIds: zod_1.z.array(zod_1.z.string()),
    invitedBy: zod_1.z.string(),
});
const respondSchema = zod_1.z.object({
    userId: zod_1.z.string(),
    response: zod_1.z.enum(['accepted', 'declined', 'maybe']),
});
// IMPORTANT: specific routes before /:planId to avoid routing conflicts
router.get('/invitations/:userId', async (req, res, next) => {
    try {
        const { userId } = req.params;
        const invitations = await (0, services_1.getUserInvitations)(userId);
        res.json({ invitations, count: invitations.length });
    }
    catch (err) {
        next(err);
    }
});
router.get('/user/:userId', async (req, res, next) => {
    try {
        const { userId } = req.params;
        const plans = await (0, services_1.getUserPlans)(userId);
        res.json({ plans, count: plans.length });
    }
    catch (err) {
        next(err);
    }
});
router.post('/', (0, validate_1.validateBody)(createPlanSchema), async (req, res, next) => {
    try {
        const body = req.body;
        const plan = await (0, services_1.createPlan)(body);
        res.status(201).json(plan);
    }
    catch (err) {
        next(err);
    }
});
router.get('/:planId', async (req, res, next) => {
    try {
        const { planId } = req.params;
        const plan = await (0, services_1.getPlan)(planId);
        if (!plan)
            throw new errorHandler_1.AppError(404, 'Plan not found');
        res.json(plan);
    }
    catch (err) {
        next(err);
    }
});
router.post('/:planId/invites', (0, validate_1.validateBody)(sendInvitesSchema), async (req, res, next) => {
    try {
        const { planId } = req.params;
        const { userIds, invitedBy } = req.body;
        const result = await (0, services_1.sendInvites)(planId, userIds, invitedBy);
        res.status(201).json(result);
    }
    catch (err) {
        next(err);
    }
});
router.post('/:planId/respond', (0, validate_1.validateBody)(respondSchema), async (req, res, next) => {
    try {
        const { planId } = req.params;
        const { userId, response } = req.body;
        const result = await (0, services_1.respondToInvite)(planId, userId, response);
        res.json(result);
    }
    catch (err) {
        next(err);
    }
});
router.post('/:planId/book', async (req, res, next) => {
    try {
        const { planId } = req.params;
        const booking = await (0, bookingAgent_1.initiateBooking)(planId);
        res.json(booking);
    }
    catch (err) {
        const error = err;
        res.status(503).json({ error: 'Booking agent unavailable', details: error.message });
    }
});
exports.default = router;
//# sourceMappingURL=plans.js.map