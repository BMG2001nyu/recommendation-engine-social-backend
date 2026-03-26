"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const services_1 = require("../../services");
const errorHandler_1 = require("../middleware/errorHandler");
const router = (0, express_1.Router)();
router.get('/:userId', async (req, res, next) => {
    try {
        const { userId } = req.params;
        const user = await (0, services_1.getUser)(userId);
        if (!user)
            throw new errorHandler_1.AppError(404, 'User not found');
        res.json(user);
    }
    catch (err) {
        next(err);
    }
});
router.get('/:userId/friends', async (req, res, next) => {
    try {
        const { userId } = req.params;
        const user = await (0, services_1.getUser)(userId);
        if (!user)
            throw new errorHandler_1.AppError(404, 'User not found');
        const friends = await (0, services_1.getUserFriends)(userId);
        res.json({ friends, count: friends.length });
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
//# sourceMappingURL=users.js.map