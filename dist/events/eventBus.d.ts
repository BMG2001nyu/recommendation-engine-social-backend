import { EventEmitter } from 'events';
import type { EngagementEvent, EventType } from '../types';
export type EventHandler = (event: EngagementEvent) => Promise<void> | void;
interface PublishOptions {
    venueId?: string;
    planId?: string;
    metadata?: Record<string, unknown>;
}
declare class LunaEventBus extends EventEmitter {
    constructor();
    /**
     * Persist event to DB then emit asynchronously via setImmediate.
     * Callers never block on downstream handlers.
     */
    publish(type: EventType, userId: string, opts?: PublishOptions): Promise<EngagementEvent>;
    subscribe(type: EventType | '*', handler: EventHandler): void;
    unsubscribe(type: EventType | '*', handler: EventHandler): void;
}
export declare const eventBus: LunaEventBus;
export {};
//# sourceMappingURL=eventBus.d.ts.map