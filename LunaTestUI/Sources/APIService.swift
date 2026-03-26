import Foundation

enum APIError: LocalizedError {
    case invalidURL
    case decodingError(String)
    case httpError(Int, String)

    var errorDescription: String? {
        switch self {
        case .invalidURL: return "Invalid URL"
        case .decodingError(let msg): return "Decode error: \(msg)"
        case .httpError(let code, let msg): return "HTTP \(code): \(msg)"
        }
    }
}

@MainActor
class APIService: ObservableObject {
    @Published var baseURL: String = UserDefaults.standard.string(forKey: "baseURL") ?? "http://localhost:3000"
    @Published var isLoading = false
    @Published var lastError: String?
    @Published var lastRawResponse: String?

    private let decoder: JSONDecoder = {
        let d = JSONDecoder()
        d.keyDecodingStrategy = .convertFromSnakeCase
        return d
    }()

    func saveBaseURL() {
        UserDefaults.standard.set(baseURL, forKey: "baseURL")
    }

    private func request<T: Decodable>(
        _ path: String,
        method: String = "GET",
        body: [String: Any]? = nil
    ) async throws -> T {
        let urlStr = "\(baseURL)\(path)"
        guard let url = URL(string: urlStr) else { throw APIError.invalidURL }

        var req = URLRequest(url: url)
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        req.timeoutInterval = 10

        if let body {
            req.httpBody = try? JSONSerialization.data(withJSONObject: body)
        }

        let (data, response) = try await URLSession.shared.data(for: req)
        lastRawResponse = String(data: data, encoding: .utf8)

        if let httpResp = response as? HTTPURLResponse, !(200...299).contains(httpResp.statusCode) {
            let msg = String(data: data, encoding: .utf8) ?? "Unknown error"
            throw APIError.httpError(httpResp.statusCode, msg)
        }

        do {
            return try decoder.decode(T.self, from: data)
        } catch {
            throw APIError.decodingError("\(error)\nRaw: \(String(data: data, encoding: .utf8) ?? "?")")
        }
    }

    // MARK: - Health
    func getHealth() async throws -> HealthResponse {
        try await request("/health")
    }

    // MARK: - Feed
    func getFeed(userId: String, limit: Int = 10) async throws -> FeedResponse {
        try await request("/api/feed/\(userId)?limit=\(limit)")
    }

    // MARK: - Venues
    func getVenues(city: String? = nil, category: String? = nil, limit: Int = 20) async throws -> VenueListResponse {
        var query = "?limit=\(limit)"
        if let city {
            query += "&city=\(city.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? city)"
        }
        if let category {
            query += "&category=\(category.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? category)"
        }
        return try await request("/api/venues\(query)")
    }

    func getVenue(id: String) async throws -> LunaVenue {
        try await request("/api/venues/\(id)")
    }

    func getVenueWithSocialProof(id: String, userId: String) async throws -> VenueDetailResponse {
        try await request("/api/venues/\(id)?userId=\(userId)")
    }

    // MARK: - Interests
    func expressInterest(userId: String, venueId: String, level: String) async throws -> VenueEngagement {
        try await request("/api/interests", method: "POST", body: [
            "userId": userId, "venueId": venueId, "level": level,
        ])
    }

    func getUserEngagements(userId: String) async throws -> EngagementListResponse {
        try await request("/api/interests/\(userId)")
    }

    func getVenueEngagements(venueId: String) async throws -> EngagementListResponse {
        try await request("/api/interests/venue/\(venueId)")
    }

    // MARK: - Plans
    func createPlan(
        venueId: String, createdBy: String, scheduledTime: String, inviteeIds: [String] = []
    ) async throws -> LunaPlan {
        var body: [String: Any] = [
            "venueId": venueId,
            "createdBy": createdBy,
            "scheduledTime": scheduledTime,
        ]
        if !inviteeIds.isEmpty { body["inviteeIds"] = inviteeIds }
        return try await request("/api/plans", method: "POST", body: body)
    }

    func getPlan(id: String) async throws -> LunaPlan {
        try await request("/api/plans/\(id)")
    }

    func getUserPlans(userId: String) async throws -> PlanListResponse {
        try await request("/api/plans/user/\(userId)")
    }

    func getUserInvitations(userId: String) async throws -> InvitationListResponse {
        try await request("/api/plans/invitations/\(userId)")
    }

    func sendInvites(planId: String, userIds: [String], invitedBy: String) async throws -> [PlanParticipant] {
        try await request("/api/plans/\(planId)/invites", method: "POST", body: [
            "userIds": userIds, "invitedBy": invitedBy,
        ])
    }

    func respondToInvite(planId: String, userId: String, response: String) async throws -> PlanParticipant {
        try await request("/api/plans/\(planId)/respond", method: "POST", body: [
            "userId": userId, "response": response,
        ])
    }

    func bookPlan(planId: String) async throws -> BookingResult {
        try await request("/api/plans/\(planId)/book", method: "POST", body: [:])
    }

    // MARK: - Users
    func getUser(userId: String) async throws -> LunaUser {
        try await request("/api/users/\(userId)")
    }

    func getUserFriends(userId: String) async throws -> FriendsResponse {
        try await request("/api/users/\(userId)/friends")
    }

    // MARK: - Events
    func postEvent(type: String, userId: String, venueId: String? = nil, planId: String? = nil) async throws {
        var body: [String: Any] = ["type": type, "userId": userId]
        if let v = venueId { body["venueId"] = v }
        if let p = planId { body["planId"] = p }
        let _: EventAccepted = try await request("/api/events", method: "POST", body: body)
    }
}
