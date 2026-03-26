export interface User {
    id: string;
    name: string;
    email: string;
    lat: number;
    lng: number;
    city: string;
    createdAt: string;
}
export interface Interest {
    id: string;
    userId: string;
    category: string;
    weight: number;
    source: 'explicit' | 'inferred' | 'behavioral';
    engagementCount: number;
    createdAt: string;
}
/** hour index 0–23, value 0–100 representing % busyness */
export type BusynessHour = number;
/** 24 hourly values */
export type BusynessDay = BusynessHour[];
/** 7 days (0 = Sunday … 6 = Saturday) */
export type BusynessPattern = BusynessDay[];
export interface Venue {
    id: string;
    name: string;
    category: string;
    tags: string[];
    lat: number;
    lng: number;
    address: string;
    city: string;
    rating: number;
    priceLevel: 1 | 2 | 3 | 4;
    busynessPattern: BusynessPattern;
    photos: string[];
    vibeDescription: string;
    qualityScore: number;
    trendingScore: number;
    engagementCount: number;
    createdAt: string;
}
export interface SocialEdge {
    userId: string;
    friendId: string;
    strength: number;
    initiatorScore: number;
    mutualFriends: number;
}
export type InterestLevel = 'viewed' | 'interested' | 'planning' | 'confirmed' | 'attended';
/** Ordered commitment levels for comparison */
export declare const INTEREST_LEVEL_ORDER: Record<InterestLevel, number>;
export interface VenueEngagement {
    id: string;
    userId: string;
    venueId: string;
    level: InterestLevel;
    createdAt: string;
    updatedAt: string;
}
export interface Plan {
    id: string;
    venueId: string;
    createdBy: string;
    scheduledTime: string;
    status: 'draft' | 'open' | 'confirmed' | 'completed' | 'cancelled';
    bookingReference?: string;
    bookingDetails?: BookingDetails;
    createdAt: string;
    updatedAt: string;
}
export interface BookingDetails {
    confirmationNumber: string;
    reservationName: string;
    partySize: number;
    specialInstructions?: string;
    agentNotes: string;
}
export interface PlanParticipant {
    planId: string;
    userId: string;
    status: 'invited' | 'accepted' | 'declined' | 'maybe';
    invitedBy: string;
    respondedAt?: string;
    createdAt: string;
}
export interface PlanWithDetails extends Plan {
    venue: Venue;
    participants: Array<PlanParticipant & {
        user: User;
    }>;
}
export type EventType = 'feed_view' | 'venue_view' | 'interest_expressed' | 'interest_withdrawn' | 'plan_created' | 'invite_sent' | 'invite_accepted' | 'invite_declined' | 'plan_confirmed' | 'booking_initiated' | 'booking_completed';
export interface EngagementEvent {
    id: string;
    userId: string;
    venueId?: string;
    planId?: string;
    type: EventType;
    metadata: Record<string, unknown>;
    timestamp: string;
}
export interface Recommendation {
    venue: Venue;
    suggestedPeople: SuggestedPerson[];
    suggestedTime: TimeSlot;
    score: RecommendationScore;
    socialProof: SocialProof;
    coldStartStrategy?: ColdStartStrategy;
}
export interface SuggestedPerson {
    userId: string;
    name: string;
    reason: 'friend' | 'mutual' | 'compatible';
    compatibilityScore: number;
    hasExpressedInterest: boolean;
    sharedInterests: string[];
}
export interface TimeSlot {
    startTime: string;
    endTime: string;
    confidence: number;
    reasoning: string;
    availableFriendCount: number;
    busynessLevel: number;
}
export interface RecommendationScore {
    venueMatch: number;
    socialScore: number;
    temporalScore: number;
    freshnessBonus: number;
    overall: number;
}
export interface SocialProof {
    interestedCount: number;
    planningCount: number;
    confirmedCount: number;
    friendsInterested: Array<{
        userId: string;
        name: string;
    }>;
    friendsConfirmed: Array<{
        userId: string;
        name: string;
    }>;
    momentumTrend: 'cold' | 'warming' | 'hot' | 'peaking';
}
export interface ColdStartStrategy {
    approach: 'trending' | 'editorial' | 'predicted_social' | 'demographic';
    confidence: number;
    explanation: string;
}
export interface InterestProfile {
    userId: string;
    weightedInterests: WeightedInterest[];
    distinctivenessMap: Record<string, number>;
    behaviorSignals: BehaviorSignals;
    updatedAt: string;
}
export interface WeightedInterest {
    category: string;
    rawWeight: number;
    distinctiveness: number;
    finalWeight: number;
}
export interface BehaviorSignals {
    avgViewDuration: number;
    saveRate: number;
    shareRate: number;
    planConversionRate: number;
    preferredDays: number[];
    preferredHours: number[];
    pricePreference: number;
}
export interface FeedRequest {
    userId: string;
    limit?: number;
    offset?: number;
    lat?: number;
    lng?: number;
}
export interface FeedResponse {
    recommendations: Recommendation[];
    userId: string;
    generatedAt: string;
    strategy: 'personalized' | 'cold_start' | 'hybrid';
    count: number;
}
export interface ExpressInterestRequest {
    userId: string;
    venueId: string;
    level: InterestLevel;
}
export interface CreatePlanRequest {
    venueId: string;
    createdBy: string;
    scheduledTime: string;
    inviteeIds?: string[];
}
export interface InviteResponseRequest {
    planId: string;
    userId: string;
    response: 'accepted' | 'declined' | 'maybe';
}
export interface PropagationResult {
    notifiedUserIds: string[];
    signalStrengths: Record<string, number>;
}
//# sourceMappingURL=index.d.ts.map