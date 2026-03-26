import type { User, SocialEdge } from '../../types'
import { getDb } from '../../db/database'

// ─── DB row shapes ────────────────────────────────────────────────────────────

interface UserRow {
  id: string
  name: string
  email: string
  lat: number
  lng: number
  city: string
  created_at: string
}

interface EdgeRow {
  user_id: string
  friend_id: string
  strength: number
  initiator_score: number
  mutual_friends: number
  created_at: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rowToUser(row: UserRow): User {
  return {
    id:        row.id,
    name:      row.name,
    email:     row.email,
    lat:       row.lat,
    lng:       row.lng,
    city:      row.city,
    createdAt: row.created_at,
  }
}

function rowToEdge(row: EdgeRow): SocialEdge {
  return {
    userId:         row.user_id,
    friendId:       row.friend_id,
    strength:       row.strength,
    initiatorScore: row.initiator_score,
    mutualFriends:  row.mutual_friends,
  }
}

// ─── Direct friends ───────────────────────────────────────────────────────────

export function getFriends(userId: string): Array<User & { edge: SocialEdge }> {
  const db = getDb()
  const rows = db.prepare(`
    SELECT u.*, e.user_id, e.friend_id, e.strength, e.initiator_score, e.mutual_friends,
           e.created_at as edge_created_at
    FROM social_edges e
    JOIN users u ON u.id = e.friend_id
    WHERE e.user_id = ?
  `).all(userId) as Array<UserRow & EdgeRow & { edge_created_at: string }>

  return rows.map(row => ({
    ...rowToUser(row),
    edge: {
      userId:         row.user_id,
      friendId:       row.friend_id,
      strength:       row.strength,
      initiatorScore: row.initiator_score,
      mutualFriends:  row.mutual_friends,
    },
  }))
}

// ─── Mutual friends ───────────────────────────────────────────────────────────

/**
 * Return users who share at least one mutual friend with userId
 * but are NOT direct friends of userId.
 */
export function getMutuals(userId: string): Array<User & { mutualFriendIds: string[] }> {
  const db = getDb()

  // Direct friend IDs of userId
  const directRows = db.prepare(`
    SELECT friend_id FROM social_edges WHERE user_id = ?
  `).all(userId) as Array<{ friend_id: string }>
  const directFriendIds = new Set(directRows.map(r => r.friend_id))
  directFriendIds.add(userId) // exclude self

  // Friends-of-friends (depth-2 neighbors)
  const fofRows = db.prepare(`
    SELECT e2.friend_id as candidate_id, e1.friend_id as via_friend_id
    FROM social_edges e1
    JOIN social_edges e2 ON e2.user_id = e1.friend_id
    WHERE e1.user_id = ?
      AND e2.friend_id != ?
  `).all(userId, userId) as Array<{ candidate_id: string; via_friend_id: string }>

  // Group by candidate, accumulate mutual friend IDs
  const mutualMap = new Map<string, Set<string>>()
  for (const row of fofRows) {
    if (directFriendIds.has(row.candidate_id)) continue
    if (!mutualMap.has(row.candidate_id)) {
      mutualMap.set(row.candidate_id, new Set())
    }
    mutualMap.get(row.candidate_id)!.add(row.via_friend_id)
  }

  if (mutualMap.size === 0) return []

  const candidateIds = [...mutualMap.keys()]
  const placeholders = candidateIds.map(() => '?').join(',')
  const userRows = db.prepare(`
    SELECT * FROM users WHERE id IN (${placeholders})
  `).all(...candidateIds) as UserRow[]

  return userRows.map(row => ({
    ...rowToUser(row),
    mutualFriendIds: [...(mutualMap.get(row.id) ?? [])],
  }))
}

// ─── BFS neighbors ────────────────────────────────────────────────────────────

export function getBFSNeighbors(
  userId: string,
  maxDepth = 2
): Array<{ user: User; depth: number; pathStrength: number }> {
  const db = getDb()
  const visited = new Map<string, { depth: number; pathStrength: number }>()
  visited.set(userId, { depth: 0, pathStrength: 1 })

  // Queue: [userId, currentDepth, accumulatedStrength]
  const queue: Array<[string, number, number]> = [[userId, 0, 1]]

  while (queue.length > 0) {
    const [currentId, depth, strength] = queue.shift()!
    if (depth >= maxDepth) continue

    const edges = db.prepare(`
      SELECT friend_id, strength FROM social_edges WHERE user_id = ?
    `).all(currentId) as Array<{ friend_id: string; strength: number }>

    for (const edge of edges) {
      const nextStrength = strength * edge.strength
      if (!visited.has(edge.friend_id)) {
        visited.set(edge.friend_id, { depth: depth + 1, pathStrength: nextStrength })
        queue.push([edge.friend_id, depth + 1, nextStrength])
      }
    }
  }

  visited.delete(userId)

  if (visited.size === 0) return []

  const ids = [...visited.keys()]
  const placeholders = ids.map(() => '?').join(',')
  const userRows = db.prepare(`
    SELECT * FROM users WHERE id IN (${placeholders})
  `).all(...ids) as UserRow[]

  return userRows.map(row => ({
    user:         rowToUser(row),
    depth:        visited.get(row.id)!.depth,
    pathStrength: visited.get(row.id)!.pathStrength,
  }))
}

// ─── Initiator detection ──────────────────────────────────────────────────────

/**
 * For a set of user IDs, return their average initiator_score
 * across all their outgoing social_edges.
 */
export function detectInitiators(userIds: string[]): Record<string, number> {
  if (userIds.length === 0) return {}
  const db = getDb()
  const result: Record<string, number> = {}

  for (const uid of userIds) {
    const row = db.prepare(`
      SELECT AVG(initiator_score) as avg_score FROM social_edges WHERE user_id = ?
    `).get(uid) as { avg_score: number | null }
    result[uid] = row?.avg_score ?? 0.5
  }

  return result
}
