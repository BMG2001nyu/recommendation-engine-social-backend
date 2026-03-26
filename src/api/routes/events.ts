import { Router } from 'express'
import { z } from 'zod'
import { eventBus } from '../../events/eventBus'
import { validateBody } from '../middleware/validate'
import type { EventType } from '../../types'

const router = Router()

const eventSchema = z.object({
  userId: z.string(),
  type: z.enum([
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
  venueId: z.string().optional(),
  planId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
})

router.post('/', validateBody(eventSchema), async (req, res, next) => {
  try {
    const { userId, type, venueId, planId, metadata } = req.body as z.infer<typeof eventSchema>
    await eventBus.publish(type as EventType, userId, { venueId, planId, metadata })
    res.status(202).json({ accepted: true })
  } catch (err) {
    next(err)
  }
})

export default router
