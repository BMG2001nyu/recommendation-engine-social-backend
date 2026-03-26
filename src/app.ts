import 'dotenv/config'
import express from 'express'
import { apiRouter } from './api'
import { errorHandler } from './api/middleware/errorHandler'
import { registerEventHandlers } from './events/handlers'

export function createApp(): express.Application {
  const app = express()

  app.use(express.json())
  app.use(express.urlencoded({ extended: true }))

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'luna-recommendation-backend', ts: new Date().toISOString() })
  })

  app.use('/api', apiRouter)

  app.use(errorHandler)

  // Wire up async event handlers (propagation, etc.)
  registerEventHandlers()

  return app
}
