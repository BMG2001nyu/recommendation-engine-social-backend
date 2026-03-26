import { Router } from 'express'
import feedRouter from './routes/feed'
import venuesRouter from './routes/venues'
import interestsRouter from './routes/interests'
import plansRouter from './routes/plans'
import usersRouter from './routes/users'
import eventsRouter from './routes/events'

export const apiRouter = Router()

apiRouter.use('/feed', feedRouter)
apiRouter.use('/venues', venuesRouter)
apiRouter.use('/interests', interestsRouter)
apiRouter.use('/plans', plansRouter)
apiRouter.use('/users', usersRouter)
apiRouter.use('/events', eventsRouter)
