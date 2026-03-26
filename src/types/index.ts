// ─── Core Domain Types ────────────────────────────────────────────────────────

export interface User {
  id: string
  name: string
  email: string
  lat: number
  lng: number
  city: string
  createdAt: string
}

export interface Interest {
  id: string
  userId: string
  category: string
  weight: number            // 0–1, will be multiplied by distinctiveness
  source: 'explicit' | 'inferred' | 'behavioral'
  engagementCount: number   // how many times this interest was reinforced
  createdAt: string
}

// ─── Venue ────────────────────────────────────────────────────────────────────

/** hour index 0–23, value 0–100 representing % busyness */
export type BusynessHour  = number
/** 24 hourly values */
export type BusynessDay   = BusynessHour[]
/** 7 days (0 = Sunday … 6 = Saturday) */
export type BusynessPattern = BusynessDay[]

export interface Venue {
  id: string
  name: string
  category: string
  tags: string[]
  lat: number
  lng: number
  address: string
  city: string
  rating: number            // 1–5
  priceLevel: 1 | 2 | 3 | 4
  busynessPattern: BusynessPattern
  photos: string[]
  vibeDescription: string
  qualityScore: number      // computed 0–1
  trendingScore: number     // computed 0–1
  engagementCount: number
  createdAt: string
}

// ─── Social Graph ─────────────────────────────────────────────────────────────

export interface SocialEdge {
  userId: string
  friendId: string
  strength: number          // 0–1 relationship closeness
  initiatorScore: number    // 0–1 how often this person starts plans
  mutualFriends: number
}

// ─── Engagement & Intent ─────────────────────────────────────────────────────

export type InterestLevel =
  | 'viewed'
  | 'interested'
  | 'planning'
  | 'confirmed'
  | 'attended'

/** Ordered commitment levels for comparison */
export const INTEREST_LEVEL_ORDER: Record<InterestLevel, number> = {
  viewed:     0,
  interested: 1,
  planning:   2,
  confirmed:  3,
  attended:   4,
}

export interface VenueEngagement {
  id: string
  userId: string
  venueId: string
  level: InterestLevel
  createdAt: string
  updatedAt: string
}

// ─── Plans ────────────────────────────────────────────────────────────────────

export interface Plan {
  id: string
  venueId: string
  createdBy: string
  scheduledTime: string
  status: 'draft' | 'open' | 'confirmed' | 'completed' | 'cancelled'
  bookingReference?: string
  bookingDetails?: BookingDetails
  createdAt: string
  updatedAt: string
}

export interface BookingDetails {
  confirmationNumber: string
  reservationName: string
  partySize: number
  specialInstructions?: string
  agentNotes: string
}

export interface PlanParticipant {
  planId: string
  userId: string
  status: 'invited' | 'accepted' | 'declined' | 'maybe'
  invitedBy: string
  respondedAt?: string
  createdAt: string
}

export interface PlanWithDetails extends Plan {
  venue: Venue
  participants: Array<PlanParticipant & { user: User }>
}

// ─── Events ───────────────────────────────────────────────────────────────────

export type EventType =
  | 'feed_view'
  | 'venue_view'
  | 'venue_skip'
  | 'venue_share'
  | 'interest_expressed'
  | 'interest_withdrawn'
  | 'plan_created'
  | 'invite_sent'
  | 'invite_accepted'
  | 'invite_declined'
  | 'plan_confirmed'
  | 'booking_initiated'
  | 'booking_completed'

export interface EngagementEvent {
  id: string
  userId: string
  venueId?: string
  planId?: string
  type: EventType
  metadata: Record<string, unknown>
  timestamp: string
}

// ─── Recommendation Output ────────────────────────────────────────────────────

export interface Recommendation {
  venue: Venue
  suggestedPeople: SuggestedPerson[]
  suggestedTime: TimeSlot
  score: RecommendationScore
  socialProof: SocialProof
  coldStartStrategy?: ColdStartStrategy
}

export interface SuggestedPerson {
  userId: string
  name: string
  reason: 'friend' | 'mutual' | 'compatible'
  compatibilityScore: number    // 0–1
  hasExpressedInterest: boolean
  sharedInterests: string[]
}

export interface TimeSlot {
  startTime: string             // ISO datetime
  endTime: string
  confidence: number            // 0–1
  reasoning: string
  availableFriendCount: number
  busynessLevel: number         // 0–100
}

export interface RecommendationScore {
  venueMatch: number            // 0–1
  socialScore: number           // 0–1
  temporalScore: number         // 0–1
  freshnessBonus: number        // 0–1
  overall: number               // weighted composite
}

export interface SocialProof {
  interestedCount: number
  planningCount: number
  confirmedCount: number
  friendsInterested: Array<{ userId: string; name: string }>
  friendsConfirmed: Array<{ userId: string; name: string }>
  momentumTrend: 'cold' | 'warming' | 'hot' | 'peaking'
}

export interface ColdStartStrategy {
  approach: 'trending' | 'editorial' | 'predicted_social' | 'demographic'
  confidence: number
  explanation: string
}

// ─── Interest Profile ─────────────────────────────────────────────────────────

export interface InterestProfile {
  userId: string
  weightedInterests: WeightedInterest[]
  distinctivenessMap: Record<string, number>  // category → IDF-style score
  behaviorSignals: BehaviorSignals
  updatedAt: string
}

export interface WeightedInterest {
  category: string
  rawWeight: number             // 0–1 from engagement frequency
  distinctiveness: number       // inverse-frequency multiplier
  finalWeight: number           // rawWeight × distinctiveness
}

export interface BehaviorSignals {
  avgViewDuration: number       // seconds
  saveRate: number              // saves / views
  shareRate: number
  planConversionRate: number    // plans created / interests expressed
  preferredDays: number[]       // 0–6
  preferredHours: number[]      // 0–23
  pricePreference: number       // 1–4
}

// ─── API Shapes ───────────────────────────────────────────────────────────────

export interface FeedRequest {
  userId: string
  limit?: number
  offset?: number
  lat?: number
  lng?: number
}

export interface FeedResponse {
  recommendations: Recommendation[]
  userId: string
  generatedAt: string
  strategy: 'personalized' | 'cold_start' | 'hybrid'
  count: number
}

export interface ExpressInterestRequest {
  userId: string
  venueId: string
  level: InterestLevel
}

export interface CreatePlanRequest {
  venueId: string
  createdBy: string
  scheduledTime: string
  inviteeIds?: string[]
}

export interface InviteResponseRequest {
  planId: string
  userId: string
  response: 'accepted' | 'declined' | 'maybe'
}

export interface PropagationResult {
  notifiedUserIds: string[]
  signalStrengths: Record<string, number>
}
