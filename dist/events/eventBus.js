"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.eventBus = void 0;
const events_1 = require("events");
const uuid_1 = require("uuid");
const database_1 = require("../db/database");
class LunaEventBus extends events_1.EventEmitter {
    constructor() {
        super();
        this.setMaxListeners(100);
    }
    /**
     * Persist event to DB then emit asynchronously via setImmediate.
     * Callers never block on downstream handlers.
     */
    async publish(type, userId, opts = {}) {
        const event = {
            id: (0, uuid_1.v4)(),
            userId,
            venueId: opts.venueId,
            planId: opts.planId,
            type,
            metadata: opts.metadata ?? {},
            timestamp: new Date().toISOString(),
        };
        // Persist synchronously — the record must exist before handlers run
        try {
            const db = (0, database_1.getDb)();
            db.prepare(`
        INSERT INTO engagement_events (id, user_id, venue_id, plan_id, event_type, metadata, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(event.id, event.userId, event.venueId ?? null, event.planId ?? null, event.type, JSON.stringify(event.metadata), event.timestamp);
        }
        catch (err) {
            console.error('[EventBus] persist failed:', err);
        }
        // Dispatch to listeners on next tick so the HTTP response can return first
        setImmediate(() => {
            this.emit(type, event);
            this.emit('*', event);
        });
        return event;
    }
    subscribe(type, handler) {
        this.on(type, handler);
    }
    unsubscribe(type, handler) {
        this.off(type, handler);
    }
}
exports.eventBus = new LunaEventBus();
//# sourceMappingURL=eventBus.js.map