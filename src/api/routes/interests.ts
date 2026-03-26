import { Router } from 'express'
import { z } from 'zod'
import { expressInterest, getUserEngagements, getVenueEngagements } from '../../services'
import { AppError } from '../middleware/errorHandler'
import { validateBody } from '../middleware/validate'

const router = Router()

const expressInterestSchema = z.object({
  userId: z.string().min(1),
  venueId: z.string(),
  level: z.enum(['viewed', 'interested', 'planning', 'confirmed', 'attended']),
})

router.post('/', validateBody(expressInterestSchema), async (req, res, next) => {
  try {
    const { userId, venueId, level } = req.body as z.infer<typeof expressInterestSchema>
    const engagement = await expressInterest(userId, venueId, level)
    res.status(201).json(engagement)
  } catch (err) {
    next(err)
  }
})

router.get('/venue/:venueId', async (req, res, next) => {
  try {
    const { venueId } = req.params
    const engagements = await getVenueEngagements(venueId)
    res.json({ engagements, count: engagements.length })
  } catch (err) {
    next(err)
  }
})

router.get('/:userId', async (req, res, next) => {
  try {
    const { userId } = req.params
    const engagements = await getUserEngagements(userId)
    if (!engagements) throw new AppError(404, 'User not found')
    res.json({ engagements, count: engagements.length })
  } catch (err) {
    next(err)
  }
})

export default router
