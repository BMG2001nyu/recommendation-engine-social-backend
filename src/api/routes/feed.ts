import { Router } from 'express'
import { z } from 'zod'
import { generateFeed, detectColdStart, getUser } from '../../services'
import { eventBus } from '../../events/eventBus'
import { AppError } from '../middleware/errorHandler'
import { validateQuery } from '../middleware/validate'
import type { FeedResponse } from '../../types'

const router = Router()

const feedQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
})

router.get(
  '/:userId',
  validateQuery(feedQuerySchema),
  async (req, res, next) => {
    try {
      const { userId } = req.params
      const { limit } = (req as typeof req & { validatedQuery: z.infer<typeof feedQuerySchema> }).validatedQuery

      const user = await getUser(userId)
      if (!user) throw new AppError(404, 'User not found')

      const [recommendations, coldStartInfo] = await Promise.all([
        generateFeed(userId, limit),
        detectColdStart(userId),
      ])

      await eventBus.publish('feed_view', userId, {})

      const info = coldStartInfo as Record<string, unknown>
      const strategy: FeedResponse['strategy'] = info.isColdStart
        ? 'cold_start'
        : info.isHybrid
          ? 'hybrid'
          : 'personalized'

      const response: FeedResponse = {
        recommendations,
        userId,
        generatedAt: new Date().toISOString(),
        strategy,
        count: recommendations.length,
      }

      res.json(response)
    } catch (err) {
      next(err)
    }
  },
)

export default router
