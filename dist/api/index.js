"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiRouter = void 0;
const express_1 = require("express");
const feed_1 = __importDefault(require("./routes/feed"));
const venues_1 = __importDefault(require("./routes/venues"));
const interests_1 = __importDefault(require("./routes/interests"));
const plans_1 = __importDefault(require("./routes/plans"));
const users_1 = __importDefault(require("./routes/users"));
const events_1 = __importDefault(require("./routes/events"));
exports.apiRouter = (0, express_1.Router)();
exports.apiRouter.use('/feed', feed_1.default);
exports.apiRouter.use('/venues', venues_1.default);
exports.apiRouter.use('/interests', interests_1.default);
exports.apiRouter.use('/plans', plans_1.default);
exports.apiRouter.use('/users', users_1.default);
exports.apiRouter.use('/events', events_1.default);
//# sourceMappingURL=index.js.map