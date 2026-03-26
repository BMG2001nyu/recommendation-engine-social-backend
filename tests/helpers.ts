import Database from 'better-sqlite3'
import { v4 as uuidv4 } from 'uuid'

export function insertUser(
  db: Database.Database,
  overrides: Partial<{
    id: string
    name: string
    email: string
    lat: number
    lng: number
    city: string
  }> = {}
) {
  const user = {
    id: overrides.id ?? uuidv4(),
    name: overrides.name ?? 'Test User',
    email: overrides.email ?? `${uuidv4()}@test.com`,
    lat: overrides.lat ?? 40.7128,
    lng: overrides.lng ?? -74.006,
    city: overrides.city ?? 'New York',
  }
  db.prepare(
    'INSERT INTO users (id, name, email, lat, lng, city) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(user.id, user.name, user.email, user.lat, user.lng, user.city)
  return user
}

export function insertVenue(
  db: Database.Database,
  overrides: Partial<{
    id: string
    name: string
    category: string
    qualityScore: number
    trendingScore: number
    city: string
    rating: number
    priceLevel: number
  }> = {}
) {
  const busynessPattern = Array.from({ length: 7 }, () => Array(24).fill(50))
  // Set busyness at hour 20 on Fridays (day 5) to 65 (sweet spot)
  busynessPattern[5][20] = 65

  const venue = {
    id: overrides.id ?? uuidv4(),
    name: overrides.name ?? 'Test Venue',
    category: overrides.category ?? 'jazz clubs',
    city: overrides.city ?? 'New York',
    qualityScore: overrides.qualityScore ?? 0.8,
    trendingScore: overrides.trendingScore ?? 0.5,
    rating: overrides.rating ?? 4.2,
    priceLevel: overrides.priceLevel ?? 2,
  }

  db.prepare(`
    INSERT INTO venues (id, name, category, tags, lat, lng, address, city, rating, price_level, busyness_pattern, photos, vibe_description, quality_score, trending_score, engagement_count)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    venue.id,
    venue.name,
    venue.category,
    JSON.stringify(['jazz', 'intimate']),
    40.73,
    -74.0,
    '123 Test St',
    venue.city,
    venue.rating,
    venue.priceLevel,
    JSON.stringify(busynessPattern),
    JSON.stringify([]),
    'Great vibe',
    venue.qualityScore,
    venue.trendingScore,
    0
  )

  return { ...venue, busynessPattern, tags: ['jazz', 'intimate'] }
}

export function insertSocialEdge(
  db: Database.Database,
  userId: string,
  friendId: string,
  strength = 0.8,
  initiatorScore = 0.7
) {
  db.prepare(
    'INSERT INTO social_edges (user_id, friend_id, strength, initiator_score, mutual_friends) VALUES (?, ?, ?, ?, ?)'
  ).run(userId, friendId, strength, initiatorScore, 0)
}

export function insertInterest(
  db: Database.Database,
  userId: string,
  category: string,
  weight = 0.8,
  engagementCount = 5
) {
  db.prepare(
    'INSERT OR REPLACE INTO interests (id, user_id, category, weight, source, engagement_count) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(uuidv4(), userId, category, weight, 'explicit', engagementCount)
}

export function insertEngagement(
  db: Database.Database,
  userId: string,
  venueId: string,
  level: string
) {
  db.prepare(
    'INSERT OR REPLACE INTO venue_engagements (id, user_id, venue_id, level) VALUES (?, ?, ?, ?)'
  ).run(uuidv4(), userId, venueId, level)
}

export function insertAvailability(
  db: Database.Database,
  userId: string,
  dayOfWeek: number,
  hour: number
) {
  db.prepare(
    'INSERT OR REPLACE INTO availability_slots (id, user_id, day_of_week, hour, available) VALUES (?, ?, ?, ?, 1)'
  ).run(uuidv4(), userId, dayOfWeek, hour)
}
