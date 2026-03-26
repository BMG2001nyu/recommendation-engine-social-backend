import { EventEmitter } from 'events'
import { v4 as uuidv4 } from 'uuid'
import type { EngagementEvent, EventType } from '../types'
import { getDb } from '../db/database'

export type EventHandler = (event: EngagementEvent) => Promise<void> | void

interface PublishOptions {
  venueId?: string
  planId?: string
  metadata?: Record<string, unknown>
}

class LunaEventBus extends EventEmitter {
  constructor() {
    super()
    this.setMaxListeners(100)
  }

  /**
   * Persist event to DB then emit asynchronously via setImmediate.
   * Callers never block on downstream handlers.
   */
  async publish(type: EventType, userId: string, opts: PublishOptions = {}): Promise<EngagementEvent> {
    const event: EngagementEvent = {
      id: uuidv4(),
      userId,
      venueId: opts.venueId,
      planId: opts.planId,
      type,
      metadata: opts.metadata ?? {},
      timestamp: new Date().toISOString(),
    }

    // Persist synchronously — the record must exist before handlers run
    try {
      const db = getDb()
      db.prepare(`
        INSERT INTO engagement_events (id, user_id, venue_id, plan_id, event_type, metadata, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        event.id,
        event.userId,
        event.venueId ?? null,
        event.planId ?? null,
        event.type,
        JSON.stringify(event.metadata),
        event.timestamp,
      )
    } catch (err) {
      console.error('[EventBus] persist failed:', err)
    }

    // Dispatch to listeners on next tick so the HTTP response can return first
    setImmediate(() => {
      this.emit(type, event)
      this.emit('*', event)
    })

    return event
  }

  subscribe(type: EventType | '*', handler: EventHandler): void {
    this.on(type as string, handler)
  }

  unsubscribe(type: EventType | '*', handler: EventHandler): void {
    this.off(type as string, handler)
  }
}

export const eventBus = new LunaEventBus()
