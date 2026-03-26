import SwiftUI

struct InterestsView: View {
    @ObservedObject var api: APIService
    @Binding var selectedUser: String

    @State private var tab = 0

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Picker("", selection: $tab) {
                    Text("Express Interest").tag(0)
                    Text("My Engagements").tag(1)
                    Text("Venue Engagements").tag(2)
                }
                .pickerStyle(.segmented)
                .frame(maxWidth: 400)
                Spacer()
            }
            .padding(.horizontal)
            .padding(.vertical, 10)
            .background(Color(nsColor: .windowBackgroundColor))

            Divider()

            switch tab {
            case 0:
                ExpressInterestPanel(api: api, selectedUser: $selectedUser)
            case 1:
                UserEngagementsPanel(api: api, selectedUser: $selectedUser)
            default:
                VenueEngagementsPanel(api: api)
            }
        }
    }
}

// MARK: - Express Interest Panel
struct ExpressInterestPanel: View {
    @ObservedObject var api: APIService
    @Binding var selectedUser: String

    @State private var venues: [LunaVenue] = []
    @State private var selectedVenueId = ""
    @State private var selectedLevel = "interested"
    @State private var isLoading = false
    @State private var successMsg: String?
    @State private var error: String?
    @State private var result: VenueEngagement?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Text("Express Interest in a Venue")
                    .font(.title3).fontWeight(.semibold)

                GroupBox {
                    VStack(alignment: .leading, spacing: 14) {
                        UserPickerRow(selectedUser: $selectedUser, label: "User:")

                        VStack(alignment: .leading, spacing: 4) {
                            Text("Venue").font(.caption).foregroundColor(.secondary)
                            if venues.isEmpty {
                                Button("Load Venues") { Task { await loadVenues() } }
                                    .buttonStyle(.bordered)
                            } else {
                                Picker("", selection: $selectedVenueId) {
                                    Text("— Select Venue —").tag("")
                                    ForEach(venues) { v in
                                        Text("\(v.name) — \(v.city ?? "")").tag(v.id)
                                    }
                                }
                                .pickerStyle(.menu)
                            }
                        }

                        VStack(alignment: .leading, spacing: 4) {
                            Text("Interest Level").font(.caption).foregroundColor(.secondary)
                            Picker("", selection: $selectedLevel) {
                                ForEach(interestLevels, id: \.self) { level in
                                    Text(level.capitalized).tag(level)
                                }
                            }
                            .pickerStyle(.segmented)
                        }

                        HStack(spacing: 12) {
                            Button {
                                Task { await submit() }
                            } label: {
                                if isLoading {
                                    Label("Submitting…", systemImage: "heart")
                                } else {
                                    Label("Express Interest", systemImage: "heart.fill")
                                }
                            }
                            .buttonStyle(.borderedProminent)
                            .disabled(selectedVenueId.isEmpty || isLoading)

                            if let msg = successMsg {
                                Label(msg, systemImage: "checkmark.circle.fill")
                                    .font(.caption).foregroundColor(.green)
                            }
                        }

                        if let error {
                            ErrorBanner(message: error)
                        }
                    }
                    .padding(.vertical, 4)
                }

                if let result {
                    GroupBox(label: Label("Result", systemImage: "checkmark.seal")) {
                        Grid(alignment: .leading, horizontalSpacing: 12, verticalSpacing: 6) {
                            GridRow {
                                Text("User").font(.caption).foregroundColor(.secondary)
                                Text(userName(result.userId)).font(.caption)
                            }
                            GridRow {
                                Text("Venue ID").font(.caption).foregroundColor(.secondary)
                                Text(result.venueId).font(.caption)
                            }
                            GridRow {
                                Text("Level").font(.caption).foregroundColor(.secondary)
                                BadgeView(text: result.level, color: .orange)
                            }
                            if let at = result.updatedAt {
                                GridRow {
                                    Text("Updated").font(.caption).foregroundColor(.secondary)
                                    Text(formattedDate(at)).font(.caption2)
                                }
                            }
                        }
                        .padding(.vertical, 4)
                    }
                }

                // Interest level guide
                GroupBox(label: Label("Interest Level Guide", systemImage: "info.circle")) {
                    VStack(alignment: .leading, spacing: 4) {
                        ForEach([
                            ("viewed", "Just browsed the venue"),
                            ("interested", "Interested in going"),
                            ("planning", "Actively planning a visit"),
                            ("confirmed", "Visit is confirmed"),
                            ("attended", "Already attended"),
                        ], id: \.0) { level, desc in
                            HStack(spacing: 8) {
                                BadgeView(text: level, color: .orange)
                                Text(desc).font(.caption).foregroundColor(.secondary)
                            }
                        }
                    }
                    .padding(.vertical, 4)
                }
            }
            .padding()
        }
        .task { await loadVenues() }
    }

    func loadVenues() async {
        do {
            let r = try await api.getVenues(limit: 20)
            venues = r.venues
            if let first = r.venues.first { selectedVenueId = first.id }
        } catch {}
    }

    func submit() async {
        guard !selectedVenueId.isEmpty else { return }
        isLoading = true
        successMsg = nil
        error = nil
        do {
            result = try await api.expressInterest(userId: selectedUser, venueId: selectedVenueId, level: selectedLevel)
            successMsg = "Saved!"
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }
}

// MARK: - User Engagements Panel
struct UserEngagementsPanel: View {
    @ObservedObject var api: APIService
    @Binding var selectedUser: String

    @State private var engagements: [VenueEngagement] = []
    @State private var count = 0
    @State private var isLoading = false
    @State private var error: String?

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 12) {
                UserPickerRow(selectedUser: $selectedUser, label: "User:")
                Spacer()
                Button {
                    Task { await load() }
                } label: {
                    Label("Load", systemImage: "arrow.clockwise")
                }
                .buttonStyle(.borderedProminent)
                .disabled(isLoading)
            }
            .padding(.horizontal)
            .padding(.vertical, 10)

            Divider()

            if let error {
                ErrorBanner(message: error).padding()
            }

            if isLoading {
                LoadingRow(message: "Loading engagements…")
            } else if engagements.isEmpty {
                ContentUnavailableView("No Engagements", systemImage: "heart.slash",
                    description: Text("This user hasn't engaged with any venues"))
            } else {
                HStack {
                    Text("\(count) engagements for \(userName(selectedUser))")
                        .font(.caption).foregroundColor(.secondary)
                    Spacer()
                }
                .padding(.horizontal)
                .padding(.vertical, 4)

                List(engagements) { eng in
                    EngagementRow(engagement: eng, showUser: false)
                }
                .listStyle(.plain)
            }
        }
        .task { await load() }
        .onChange(of: selectedUser) { _, _ in Task { await load() } }
    }

    func load() async {
        isLoading = true
        error = nil
        do {
            let r = try await api.getUserEngagements(userId: selectedUser)
            engagements = r.engagements
            count = r.count
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }
}

// MARK: - Venue Engagements Panel
struct VenueEngagementsPanel: View {
    @ObservedObject var api: APIService

    @State private var venueId = "v1"
    @State private var engagements: [VenueEngagement] = []
    @State private var count = 0
    @State private var isLoading = false
    @State private var error: String?

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 10) {
                Text("Venue ID:").font(.caption).foregroundColor(.secondary)
                TextField("e.g. v1", text: $venueId)
                    .textFieldStyle(.roundedBorder)
                    .frame(maxWidth: 120)
                Spacer()
                Button {
                    Task { await load() }
                } label: {
                    Label("Load", systemImage: "arrow.clockwise")
                }
                .buttonStyle(.borderedProminent)
                .disabled(isLoading || venueId.isEmpty)
            }
            .padding(.horizontal)
            .padding(.vertical, 10)

            Divider()

            if let error {
                ErrorBanner(message: error).padding()
            }

            if isLoading {
                LoadingRow(message: "Loading engagements…")
            } else if engagements.isEmpty {
                ContentUnavailableView("No Engagements", systemImage: "building.2.slash",
                    description: Text("Enter a venue ID and tap Load"))
            } else {
                HStack {
                    Text("\(count) engagements for venue \(venueId)")
                        .font(.caption).foregroundColor(.secondary)
                    Spacer()
                }
                .padding(.horizontal)
                .padding(.vertical, 4)

                List(engagements) { eng in
                    EngagementRow(engagement: eng, showUser: true)
                }
                .listStyle(.plain)
            }
        }
    }

    func load() async {
        isLoading = true
        error = nil
        do {
            let r = try await api.getVenueEngagements(venueId: venueId)
            engagements = r.engagements
            count = r.count
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }
}

struct EngagementRow: View {
    let engagement: VenueEngagement
    let showUser: Bool

    var levelColor: Color {
        switch engagement.level {
        case "viewed": return .gray
        case "interested": return .blue
        case "planning": return .orange
        case "confirmed": return .green
        case "attended": return .purple
        default: return .secondary
        }
    }

    var body: some View {
        HStack {
            BadgeView(text: engagement.level, color: levelColor)
            Spacer()
            if showUser {
                Text(userName(engagement.userId))
                    .font(.caption)
                    .foregroundColor(.secondary)
            } else {
                Text(engagement.venueId)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            if let at = engagement.updatedAt ?? engagement.createdAt {
                Text(formattedDate(at))
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
        }
        .padding(.vertical, 2)
    }
}
