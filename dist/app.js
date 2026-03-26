"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = createApp;
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const api_1 = require("./api");
const errorHandler_1 = require("./api/middleware/errorHandler");
const handlers_1 = require("./events/handlers");
function createApp() {
    const app = (0, express_1.default)();
    app.use(express_1.default.json());
    app.use(express_1.default.urlencoded({ extended: true }));
    // Health check
    app.get('/health', (_req, res) => {
        res.json({ status: 'ok', service: 'luna-recommendation-backend', ts: new Date().toISOString() });
    });
    app.use('/api', api_1.apiRouter);
    app.use(errorHandler_1.errorHandler);
    // Wire up async event handlers (propagation, etc.)
    (0, handlers_1.registerEventHandlers)();
    return app;
}
//# sourceMappingURL=app.js.map