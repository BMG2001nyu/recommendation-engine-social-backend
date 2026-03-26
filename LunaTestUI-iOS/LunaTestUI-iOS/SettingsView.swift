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

    var body: some View {
        NavigationStack {
            ZStack {
                Color.lunaBackground.ignoresSafeArea()
                Form {
                    // ── Backend Setup ────────────────────────────────────────
                    Section {
                        VStack(alignment: .leading, spacing: 10) {
                            HStack(spacing: 8) {
                                Image(systemName: "terminal.fill")
                                    .foregroundColor(.lunaGold)
                                Text("Start the backend on your Mac")
                                    .font(.subheadline).fontWeight(.semibold)
                                    .foregroundColor(.white)
                            }
                            Text("Open a terminal and run:")
                                .font(.caption2).foregroundColor(.secondary)
                            VStack(alignment: .leading, spacing: 2) {
                                Text("cd recommendation-engine-social-backend")
                                    .font(.system(.caption2, design: .monospaced))
                                    .foregroundColor(.lunaGold)
                                Text("npm run dev")
                                    .font(.system(.caption2, design: .monospaced))
                                    .foregroundColor(.lunaGold)
                            }
                            .padding(8)
                            .background(Color.black.opacity(0.5))
                            .clipShape(RoundedRectangle(cornerRadius: 6))
                        }
                        .padding(.vertical, 4)
                        .listRowBackground(Color.lunaCard)
                    } header: {
                        Text("Backend Setup")
                    }

                    // ── Server URL ────────────────────────────────────────────
                    Section {
                        HStack {
                            TextField("http://10.20.3.95:3000", text: $api.baseURL)
                                .autocorrectionDisabled()
                                .textInputAutocapitalization(.never)
                                .keyboardType(.URL)
                            Button("Save") { api.saveBaseURL() }
                                .buttonStyle(.bordered)
                                .controlSize(.small)
                                .tint(.lunaPurple)
                        }
                    } header: {
                        Text("Server URL (Mac's IP)")
                    } footer: {
                        Text("Your Mac's IP: 10.20.3.95 — update if your network changed.")
                    }

                    // ── Health Check ──────────────────────────────────────────
                    Section("Health Check") {
                        Button {
                            Task { await checkHealth() }
                        } label: {
                            if isCheckingHealth {
                                ProgressView().controlSize(.small)
                            } else {
                                Label("Check Backend Health", systemImage: "heart.text.square")
                            }
                        }
                        .tint(.lunaPurple)
                        if let status = healthStatus {
                            HStack(spacing: 6) {
                                Circle().fill(healthColor).frame(width: 8, height: 8)
                                Text(status).foregroundColor(healthColor)
                            }
                        }
                    }

                    // ── Active User ───────────────────────────────────────────
                    Section("Active User") {
                        Picker("Global User", selection: $selectedUser) {
                            ForEach(seedUsers, id: \.id) { u in
                                Text("\(u.id) — \(u.name)").tag(u.id)
                            }
                        }
                    }

                    // ── Fire Event ────────────────────────────────────────────
                    Section("Fire Event") {
                        Picker("Event Type", selection: $eventType) {
                            ForEach(eventTypes, id: \.self) { Text($0).tag($0) }
                        }
                        HStack {
                            Text("Venue ID").foregroundColor(.secondary)
                            TextField("v1", text: $eventVenueId)
                                .multilineTextAlignment(.trailing)
                        }
                        Button {
                            Task { await fireEvent() }
                        } label: {
                            if isFiringEvent { ProgressView().controlSize(.small) }
                            else { Label("Fire Event", systemImage: "bolt.fill") }
                        }
                        .tint(.lunaPurple)
                        if let result = eventResult {
                            Text(result).font(.caption).foregroundColor(.green)
                        }
                    }

                    // ── Quick Tests ───────────────────────────────────────────
                    Section("Quick Tests") {
                        QuickTestRow(label: "Feed (u1)") {
                            Task { await quickTest { try await self.api.getFeed(userId: "u1", limit: 3) } }
                        }
                        QuickTestRow(label: "Venues List") {
                            Task { await quickTest { try await self.api.getVenues(limit: 5) } }
                        }
                        QuickTestRow(label: "User u1") {
                            Task { await quickTest { try await self.api.getUser(userId: "u1") } }
                        }
                        QuickTestRow(label: "Friends u1") {
                            Task { await quickTest { try await self.api.getUserFriends(userId: "u1") } }
                        }
                        QuickTestRow(label: "Engagements u1") {
                            Task { await quickTest { try await self.api.getUserEngagements(userId: "u1") } }
                        }
                        QuickTestRow(label: "Social Proof v1+u1") {
                            Task { await quickTest { try await self.api.getVenueWithSocialProof(id: "v1", userId: "u1") } }
                        }
                    }

                    // ── Last Response ─────────────────────────────────────────
                    if let raw = api.lastRawResponse {
                        Section("Last Response") {
                            ScrollView {
                                Text(raw)
                                    .font(.system(.caption2, design: .monospaced))
                                    .foregroundColor(.secondary)
                                    .textSelection(.enabled)
                            }
                            .frame(maxHeight: 200)
                        }
                    }

                    // ── API Endpoints ─────────────────────────────────────────
                    Section("API Endpoints") {
                        ForEach([
                            ("GET",  "/health"),
                            ("GET",  "/api/feed/:userId"),
                            ("GET",  "/api/venues"),
                            ("POST", "/api/interests"),
                            ("GET",  "/api/interests/:userId"),
                            ("POST", "/api/plans"),
                            ("GET",  "/api/plans/:planId"),
                            ("POST", "/api/plans/:planId/respond"),
                            ("POST", "/api/plans/:planId/book"),
                            ("GET",  "/api/users/:userId"),
                            ("GET",  "/api/users/:userId/friends"),
                            ("POST", "/api/events"),
                        ], id: \.1) { method, path in
                            HStack(spacing: 8) {
                                Text(method)
                                    .font(.system(.caption2, design: .monospaced))
                                    .fontWeight(.bold)
                                    .foregroundColor(method == "GET" ? .blue : .orange)
                                    .frame(width: 36, alignment: .leading)
                                Text(path)
                                    .font(.system(.caption2, design: .monospaced))
                                    .foregroundColor(.secondary)
                            }
                        }
                    }
                }
                .scrollContentBackground(.hidden)
            }
            .navigationTitle("Developer")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(.hidden, for: .navigationBar)
        }
    }

    func checkHealth() async {
        isCheckingHealth = true
        do {
            let h = try await api.getHealth()
            healthStatus = "✓ \(h.status)"
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
            try await api.postEvent(type: eventType, userId: selectedUser, venueId: eventVenueId.isEmpty ? nil : eventVenueId)
            eventResult = "✓ Accepted"
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

struct QuickTestRow: View {
    let label: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack {
                Text(label).foregroundColor(.white)
                Spacer()
                Image(systemName: "play.fill").font(.caption).foregroundColor(.lunaPurple)
            }
        }
    }
}
