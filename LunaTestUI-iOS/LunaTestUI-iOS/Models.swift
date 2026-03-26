import Foundation

// MARK: - Seed Helpers
let seedUsers: [(id: String, name: String)] = [
    ("u1", "Alex Chen"),
    ("u2", "Sarah Kim"),
    ("u3", "Marcus Williams"),
    ("u4", "Priya Patel"),
    ("u5", "James O'Brien"),
    ("u6", "Sofia Rodriguez"),
    ("u7", "Lena Fischer"),
    ("u8", "Kenji Tanaka"),
    ("u9", "Amara Osei"),
    ("u10", "Noah Bergmann"),
]

let interestLevels = ["viewed", "interested", "planning", "confirmed", "attended"]

let eventTypes = [
    "feed_view", "venue_view", "interest_expressed", "interest_withdrawn",
    "plan_created", "invite_sent", "invite_accepted", "invite_declined",
    "plan_confirmed", "booking_initiated", "booking_completed",
]

// MARK: - User
struct LunaUser: Codable, Identifiable, Hashable {
    let id: String
    let name: String
    let email: String?
    let lat: Double?
    let lng: Double?
    let city: String?
    let createdAt: String?
}

struct FriendsResponse: Codable {
    let friends: [LunaUser]
    let count: Int
}

// MARK: - Venue
struct LunaVenue: Codable, Identifiable, Hashable {
    let id: String
    let name: String
    let category: String
    let tags: [String]?
    let lat: Double?
    let lng: Double?
    let address: String?
    let city: String?
    let rating: Double
    let priceLevel: Int
    let vibeDescription: String?
    let qualityScore: Double?
    let trendingScore: Double?
    let engagementCount: Int?
    let photos: [String]?
    let createdAt: String?
}

struct VenueListResponse: Codable {
    let venues: [LunaVenue]
    let total: Int
    let limit: Int
    let offset: Int
}

// MARK: - Social Proof
struct FriendRef: Codable, Identifiable {
    var id: String { userId }
    let userId: String
    let name: String
}

struct LunaSocialProof: Codable {
    let interestedCount: Int?
    let planningCount: Int?
    let confirmedCount: Int?
    let friendsInterested: [FriendRef]?
    let friendsConfirmed: [FriendRef]?
    let momentumTrend: String?
}

struct VenueDetailResponse: Codable {
    let venue: LunaVenue
    let socialProof: LunaSocialProof?
}

// MARK: - Recommendation
struct RecommendationScore: Codable {
    let venueMatch: Double?
    let socialScore: Double?
    let temporalScore: Double?
    let freshnessBonus: Double?
    let overall: Double?
}

struct SuggestedPerson: Codable, Identifiable {
    var id: String { userId }
    let userId: String
    let name: String?
    let reason: String?
    let compatibilityScore: Double?
    let hasExpressedInterest: Bool?
    let sharedInterests: [String]?
}

struct TimeSlot: Codable {
    let startTime: String
    let endTime: String
    let confidence: Double
    let reasoning: String?
    let availableFriendCount: Int?
    let busynessLevel: Double?
}

struct ColdStartStrategy: Codable {
    let approach: String?
    let confidence: Double?
    let explanation: String?
}

struct Recommendation: Codable, Identifiable {
    var id: String { venue.id }
    let venue: LunaVenue
    let suggestedPeople: [SuggestedPerson]?
    let suggestedTime: TimeSlot?
    let score: RecommendationScore?
    let socialProof: LunaSocialProof?
    let coldStartStrategy: ColdStartStrategy?
}

struct FeedResponse: Codable {
    let recommendations: [Recommendation]
    let userId: String
    let generatedAt: String
    let strategy: String
    let count: Int
}

// MARK: - Engagements
struct VenueEngagement: Codable, Identifiable {
    var id: String { "\(userId)-\(venueId)" }
    let userId: String
    let venueId: String
    let level: String
    let createdAt: String?
    let updatedAt: String?
}

struct EngagementListResponse: Codable {
    let engagements: [VenueEngagement]
    let count: Int
}

// MARK: - Plans
struct PlanParticipant: Codable, Identifiable, Hashable {
    var id: String { "\(planId ?? "?")-\(userId)" }
    let planId: String?
    let userId: String
    let status: String
    let invitedBy: String?
    let respondedAt: String?
    let createdAt: String?
    let user: LunaUser?
}

struct BookingDetails: Codable, Hashable {
    let confirmationNumber: String?
    let reservationName: String?
    let partySize: Int?
    let specialInstructions: String?
    let agentNotes: String?
}

struct LunaPlan: Codable, Identifiable, Hashable {
    static func == (lhs: LunaPlan, rhs: LunaPlan) -> Bool { lhs.id == rhs.id }
    func hash(into hasher: inout Hasher) { hasher.combine(id) }

    let id: String
    let venueId: String
    let createdBy: String
    let scheduledTime: String
    let status: String
    let bookingReference: String?
    let bookingDetails: BookingDetails?
    let venue: LunaVenue?
    let participants: [PlanParticipant]?
    let createdAt: String?
}

struct PlanListResponse: Codable {
    let plans: [LunaPlan]
    let count: Int
}

struct InvitationListResponse: Codable {
    let invitations: [LunaPlan]
    let count: Int
}

struct BookingResult: Codable {
    let confirmationCode: String?
    let venueId: String?
    let venueName: String?
    let scheduledTime: String?
    let partySize: Int?
    let specialRequests: String?
    let contactEmail: String?
    let status: String?
    let error: String?
    let details: String?
}

struct HealthResponse: Codable {
    let status: String
    let timestamp: String?
}

struct EventAccepted: Codable {
    let accepted: Bool?
}
