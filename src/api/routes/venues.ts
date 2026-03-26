import { Router } from 'express'
import { z } from 'zod'
import { getVenue, getVenueWithSocialProof } from '../../services'
import { getDb } from '../../db/database'
import { AppError } from '../middleware/errorHandler'
import { validateQuery } from '../middleware/validate'
import type { Venue } from '../../types'

const router = Router()

const venueQuerySchema = z.object({
  userId: z.string().optional(),
})

const listQuerySchema = z.object({
  city: z.string().optional(),
  category: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
})

function rowToVenue(row: Record<string, unknown>): Venue {
  return {
    id: row.id as string,
    name: row.name as string,
    category: row.category as string,
    tags: JSON.parse((row.tags as string) || '[]'),
    lat: row.lat as number,
    lng: row.lng as number,
    address: row.address as string,
    city: row.city as string,
    rating: row.rating as number,
    priceLevel: row.price_level as 1 | 2 | 3 | 4,
    busynessPattern: JSON.parse((row.busyness_pattern as string) || '[]'),
    photos: JSON.parse((row.photos as string) || '[]'),
    vibeDescription: row.vibe_description as string,
    qualityScore: row.quality_score as number,
    trendingScore: row.trending_score as number,
    engagementCount: row.engagement_count as number,
    createdAt: row.created_at as string,
  }
}

function getAllVenues(opts: { city?: string; category?: string; limit: number; offset: number }): { venues: Venue[]; total: number } {
  const db = getDb()
  const conditions: string[] = []
  const params: unknown[] = []

  if (opts.city) {
    conditions.push('city = ?')
    params.push(opts.city)
  }
  if (opts.category) {
    conditions.push('category = ?')
    params.push(opts.category)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  const total = (db.prepare(`SELECT COUNT(*) as count FROM venues ${where}`).get(...params) as { count: number }).count
  const rows = db.prepare(`SELECT * FROM venues ${where} LIMIT ? OFFSET ?`).all(...params, opts.limit, opts.offset) as Record<string, unknown>[]

  return { venues: rows.map(rowToVenue), total }
}

router.get('/', validateQuery(listQuerySchema), async (req, res, next) => {
  try {
    const { city, category, limit, offset } = (req as typeof req & { validatedQuery: z.infer<typeof listQuerySchema> }).validatedQuery
    const { venues, total } = getAllVenues({ city, category, limit, offset })
    res.json({ venues, total, limit, offset })
  } catch (err) {
    next(err)
  }
})

router.get('/:venueId', validateQuery(venueQuerySchema), async (req, res, next) => {
  try {
    const { venueId } = req.params
    const { userId } = (req as typeof req & { validatedQuery: z.infer<typeof venueQuerySchema> }).validatedQuery

    if (userId) {
      const result = await getVenueWithSocialProof(venueId, userId)
      if (!result) throw new AppError(404, 'Venue not found')
      res.json(result)
    } else {
      const venue = await getVenue(venueId)
      if (!venue) throw new AppError(404, 'Venue not found')
      res.json(venue)
    }
  } catch (err) {
    next(err)
  }
})

export default router
