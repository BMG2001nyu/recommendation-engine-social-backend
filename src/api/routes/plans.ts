import { Router } from 'express'
import { z } from 'zod'
import {
  createPlan,
  getPlan,
  getUserPlans,
  sendInvites,
  respondToInvite,
  getUserInvitations,
} from '../../services'
import { initiateBooking } from '../../services/agent/bookingAgent'
import { AppError } from '../middleware/errorHandler'
import { validateBody } from '../middleware/validate'

const router = Router()

const createPlanSchema = z.object({
  venueId: z.string(),
  createdBy: z.string(),
  scheduledTime: z.string().datetime(),
  inviteeIds: z.array(z.string()).optional(),
})

const sendInvitesSchema = z.object({
  userIds: z.array(z.string()),
  invitedBy: z.string(),
})

const respondSchema = z.object({
  userId: z.string(),
  response: z.enum(['accepted', 'declined', 'maybe']),
})

// IMPORTANT: specific routes before /:planId to avoid routing conflicts
router.get('/invitations/:userId', async (req, res, next) => {
  try {
    const { userId } = req.params
    const invitations = await getUserInvitations(userId)
    res.json({ invitations, count: invitations.length })
  } catch (err) {
    next(err)
  }
})

router.get('/user/:userId', async (req, res, next) => {
  try {
    const { userId } = req.params
    const plans = await getUserPlans(userId)
    res.json({ plans, count: plans.length })
  } catch (err) {
    next(err)
  }
})

router.post('/', validateBody(createPlanSchema), async (req, res, next) => {
  try {
    const body = req.body as z.infer<typeof createPlanSchema>
    const plan = await createPlan(body)
    res.status(201).json(plan)
  } catch (err) {
    next(err)
  }
})

router.get('/:planId', async (req, res, next) => {
  try {
    const { planId } = req.params
    const plan = await getPlan(planId)
    if (!plan) throw new AppError(404, 'Plan not found')
    res.json(plan)
  } catch (err) {
    next(err)
  }
})

router.post('/:planId/invites', validateBody(sendInvitesSchema), async (req, res, next) => {
  try {
    const { planId } = req.params
    const { userIds, invitedBy } = req.body as z.infer<typeof sendInvitesSchema>
    const result = await sendInvites(planId, userIds, invitedBy)
    res.status(201).json(result)
  } catch (err) {
    next(err)
  }
})

router.post('/:planId/respond', validateBody(respondSchema), async (req, res, next) => {
  try {
    const { planId } = req.params
    const { userId, response } = req.body as z.infer<typeof respondSchema>
    const result = await respondToInvite(planId, userId, response)
    res.json(result)
  } catch (err) {
    next(err)
  }
})

router.post('/:planId/book', async (req, res, next) => {
  try {
    const { planId } = req.params
    const booking = await initiateBooking(planId)
    res.json(booking)
  } catch (err: unknown) {
    const error = err as Error
    res.status(503).json({ error: 'Booking agent unavailable', details: error.message })
  }
})

export default router
