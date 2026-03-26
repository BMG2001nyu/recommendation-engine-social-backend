import SwiftUI

struct SettingsView: View {
    @ObservedObject var api: APIService
    @Binding var selectedUser: String

    @State private var healthStatus: String?
    @State private var healthColor: Color = .secondary
    @State private var isCheckingHealth = false

    @State private var eventType = "venue_view"
    @State private var eventVenueId = "v1"
    @State private var eventResult: String?
    @State private var isFiringEvent = false

    @State private var rawResponse: String?
    @State private var showRaw = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Text("Developer Tools")
                    .font(.title2).fontWeight(.bold)

                // Server config
                GroupBox(label: Label("Server Configuration", systemImage: "network")) {
                    VStack(alignment: .leading, spacing: 10) {
                        HStack(spacing: 8) {
                            Text("Base URL:").font(.caption).foregroundColor(.secondary)
                            TextField("http://localhost:3000", text: $api.baseURL)
                                .textFieldStyle(.roundedBorder)
                                .font(.system(.caption, design: .monospaced))
                            Button("Save") { api.saveBaseURL() }
                                .buttonStyle(.bordered)
                                .controlSize(.small)
                        }

                        HStack(spacing: 8) {
                            Button {
                                Task { await checkHealth() }
                            } label: {
                                Label("Check Health", systemImage: "heart.text.square")
                            }
                            .buttonStyle(.borderedProminent)
                            .disabled(isCheckingHealth)

                            if let status = healthStatus {
                                HStack(spacing: 4) {
                                    Circle()
                                        .fill(healthColor)
                                        .frame(width: 8, height: 8)
                                    Text(status)
                                        .font(.caption)
                                        .foregroundColor(healthColor)
                                }
                            }
                        }
                    }
                    .padding(.vertical, 4)
                }

                // Active user
                GroupBox(label: Label("Active User", systemImage: "person.fill")) {
                    UserPickerRow(selectedUser: $selectedUser, label: "Global user:")
                        .padding(.vertical, 4)
                }

                // Fire event
                GroupBox(label: Label("Fire Event", systemImage: "bolt.fill")) {
                    VStack(alignment: .leading, spacing: 10) {
                        HStack(spacing: 10) {
                            Text("Type:").font(.caption).foregroundColor(.secondary)
                            Picker("", selection: $eventType) {
                                ForEach(eventTypes, id: \.self) { t in
                                    Text(t).tag(t)
                                }
                            }
                            .pickerStyle(.menu)
                            .frame(maxWidth: 240)
                        }
                        HStack(spacing: 10) {
                            Text("Venue ID:").font(.caption).foregroundColor(.secondary)
                            TextField("e.g. v1", text: $eventVenueId)
                                .textFieldStyle(.roundedBorder)
                                .frame(maxWidth: 100)
                        }
                        HStack(spacing: 8) {
                            Button {
                                Task { await fireEvent() }
                            } label: {
                                Label("Fire Event", systemImage: "bolt.fill")
                            }
                            .buttonStyle(.borderedProminent)
                            .disabled(isFiringEvent)

                            if let result = eventResult {
                                Text(result).font(.caption).foregroundColor(.green)
                            }
                        }
                    }
                    .padding(.vertical, 4)
                }

                // API Quick Tests
                GroupBox(label: Label("Quick API Tests", systemImage: "testtube.2")) {
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 200))], spacing: 8) {
                        QuickTestButton(label: "Health Check", icon: "heart") {
                            Task { await checkHealth() }
                        }
                        QuickTestButton(label: "Feed (u1)", icon: "house") {
                            Task { await quickTest { try await self.api.getFeed(userId: "u1", limit: 3) } }
                        }
                        QuickTestButton(label: "Venues List", icon: "building.2") {
                            Task { await quickTest { try await self.api.getVenues(limit: 5) } }
                        }
                        QuickTestButton(label: "User u1", icon: "person") {
                            Task { await quickTest { try await self.api.getUser(userId: "u1") } }
                        }
                        QuickTestButton(label: "Friends u1", icon: "person.2") {
                            Task { await quickTest { try await self.api.getUserFriends(userId: "u1") } }
                        }
                        QuickTestButton(label: "Engagements u1", icon: "heart") {
                            Task { await quickTest { try await self.api.getUserEngagements(userId: "u1") } }
                        }
                        QuickTestButton(label: "Venue v1 + Social Proof", icon: "star") {
                            Task { await quickTest { try await self.api.getVenueWithSocialProof(id: "v1", userId: "u1") } }
                        }
                        QuickTestButton(label: "Invitations u2", icon: "envelope") {
                            Task { await quickTest { try await self.api.getUserInvitations(userId: "u2") } }
                        }
                        QuickTestButton(label: "Plans u1", icon: "calendar") {
                            Task { await quickTest { try await self.api.getUserPlans(userId: "u1") } }
                        }
                    }
                }

                // Raw response viewer
                if let raw = api.lastRawResponse {
                    GroupBox(label: Label("Last Raw Response", systemImage: "doc.text")) {
                        VStack(alignment: .leading, spacing: 6) {
                            ScrollView(.horizontal) {
                                Text(raw)
                                    .font(.system(.caption2, design: .monospaced))
                                    .foregroundColor(.secondary)
                                    .textSelection(.enabled)
                            }
                            .frame(maxHeight: 200)
                        }
                        .padding(.vertical, 4)
                    }
                }

                // Endpoint reference
                GroupBox(label: Label("API Endpoint Reference", systemImage: "list.bullet")) {
                    VStack(alignment: .leading, spacing: 4) {
                        ForEach([
                            ("GET", "/health"),
                            ("GET", "/api/feed/:userId?limit=N"),
                            ("GET", "/api/venues?category=&limit="),
                            ("GET", "/api/venues/:venueId?userId="),
                            ("POST", "/api/interests { userId, venueId, level }"),
                            ("GET", "/api/interests/:userId"),
                            ("GET", "/api/interests/venue/:venueId"),
                            ("POST", "/api/plans { venueId, createdBy, scheduledTime, inviteeIds? }"),
                            ("GET", "/api/plans/:planId"),
                            ("GET", "/api/plans/user/:userId"),
                            ("GET", "/api/plans/invitations/:userId"),
                            ("POST", "/api/plans/:planId/invites { userIds, invitedBy }"),
                            ("POST", "/api/plans/:planId/respond { userId, response }"),
                            ("POST", "/api/plans/:planId/book"),
                            ("GET", "/api/users/:userId"),
                            ("GET", "/api/users/:userId/friends"),
                            ("POST", "/api/events { type, userId, venueId? }"),
                        ], id: \.1) { method, path in
                            HStack(spacing: 6) {
                                Text(method)
                                    .font(.system(.caption2, design: .monospaced))
                                    .fontWeight(.bold)
                                    .foregroundColor(method == "GET" ? .blue : .orange)
                                    .frame(width: 36, alignment: .leading)
                                Text(path)
                                    .font(.system(.caption2, design: .monospaced))
                                    .foregroundColor(.secondary)
                                    .textSelection(.enabled)
                            }
                        }
                    }
                    .padding(.vertical, 4)
                }
            }
            .padding()
        }
    }

    func checkHealth() async {
        isCheckingHealth = true
        do {
            let h = try await api.getHealth()
            healthStatus = h.status == "ok" ? "✓ \(h.status)" : h.status
            healthColor = h.status == "ok" ? .green : .orange
        } catch {
            healthStatus = "✗ \(error.localizedDescription)"
            healthColor = .red
        }
        isCheckingHealth = false
    }

    func fireEvent() async {
        isFiringEvent = true
        eventResult = nil
        do {
            try await api.postEvent(
                type: eventType,
                userId: selectedUser,
                venueId: eventVenueId.isEmpty ? nil : eventVenueId
            )
            eventResult = "✓ Event accepted"
        } catch {
            eventResult = "✗ \(error.localizedDescription)"
        }
        isFiringEvent = false
    }

    func quickTest<T: Encodable>(_ action: @escaping () async throws -> T) async {
        do {
            let result = try await action()
            let data = try? JSONEncoder().encode(result)
            api.lastRawResponse = data.flatMap { String(data: $0, encoding: .utf8) }
        } catch {
            api.lastRawResponse = "Error: \(error.localizedDescription)"
        }
    }
}

struct QuickTestButton: View {
    let label: String
    let icon: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Label(label, systemImage: icon)
                .font(.caption)
                .frame(maxWidth: .infinity)
        }
        .buttonStyle(.bordered)
        .controlSize(.small)
    }
}
