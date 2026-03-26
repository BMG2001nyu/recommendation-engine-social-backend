"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerEventHandlers = registerEventHandlers;
const eventBus_1 = require("../eventBus");
const services_1 = require("../../services");
function registerEventHandlers() {
    // When interest is expressed, propagate through social graph
    eventBus_1.eventBus.subscribe('interest_expressed', async (event) => {
        if (event.venueId) {
            try {
                (0, services_1.propagateEngagement)(event.userId, event.venueId, event.metadata?.level ?? 'interested');
            }
            catch (err) {
                console.error('[Handler] propagation failed:', err);
            }
        }
    });
    // When plan is confirmed, emit stronger signal
    eventBus_1.eventBus.subscribe('plan_confirmed', async (event) => {
        if (event.venueId) {
            try {
                (0, services_1.propagateEngagement)(event.userId, event.venueId, 'confirmed');
            }
            catch (err) {
                console.error('[Handler] plan confirmation propagation failed:', err);
            }
        }
    });
}
//# sourceMappingURL=index.js.map