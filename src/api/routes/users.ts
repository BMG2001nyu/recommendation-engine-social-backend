import { Router } from 'express'
import { getUser, getUserFriends } from '../../services'
import { AppError } from '../middleware/errorHandler'

const router = Router()

router.get('/:userId', async (req, res, next) => {
  try {
    const { userId } = req.params
    const user = await getUser(userId)
    if (!user) throw new AppError(404, 'User not found')
    res.json(user)
  } catch (err) {
    next(err)
  }
})

router.get('/:userId/friends', async (req, res, next) => {
  try {
    const { userId } = req.params
    const user = await getUser(userId)
    if (!user) throw new AppError(404, 'User not found')
    const friends = await getUserFriends(userId)
    res.json({ friends, count: friends.length })
  } catch (err) {
    next(err)
  }
})

export default router
