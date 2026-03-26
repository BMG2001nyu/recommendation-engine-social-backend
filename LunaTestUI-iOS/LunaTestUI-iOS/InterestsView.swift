import SwiftUI

struct InterestsView: View {
    @ObservedObject var api: APIService
    @Binding var selectedUser: String
    @State private var tab = 0

    var body: some View {
        NavigationStack {
            ZStack {
                Color.lunaBackground.ignoresSafeArea()
                VStack(spacing: 0) {
                    Picker("", selection: $tab) {
                        Text("Express").tag(0)
                        Text("My History").tag(1)
                        Text("By Venue").tag(2)
                    }
                    .pickerStyle(.segmented)
                    .padding()

                    switch tab {
                    case 0: ExpressInterestPanel(api: api, selectedUser: $selectedUser)
                    case 1: UserEngagementsPanel(api: api, selectedUser: $selectedUser)
                    default: VenueEngagementsPanel(api: api)
                    }
                }
            }
            .navigationTitle("Interests")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(.hidden, for: .navigationBar)
        }
    }
}

struct ExpressInterestPanel: View {
    @ObservedObject var api: APIService
    @Binding var selectedUser: String

    @State private var venues: [LunaVenue] = []
    @State private var selectedVenueId = ""
    @State private var selectedLevel = "interested"
    @State private var isLoading = false
    @State private var result: VenueEngagement?
    @State private var error: String?

    var body: some View {
        Form {
            Section("Who") {
                Picker("User", selection: $selectedUser) {
                    ForEach(seedUsers, id: \.id) { u in Text(u.name).tag(u.id) }
                }
            }

            Section("Venue") {
                if venues.isEmpty {
                    Button("Load Venues") { Task { await loadVenues() } }
                        .tint(.lunaPurple)
                } else {
                    Picker("Venue", selection: $selectedVenueId) {
                        Text("Select…").tag("")
                        ForEach(venues) { v in Text("\(v.name)").tag(v.id) }
                    }
                }
            }

            Section("Interest Level") {
                Picker("Level", selection: $selectedLevel) {
                    ForEach(interestLevels, id: \.self) { Text($0.capitalized).tag($0) }
                }
                .pickerStyle(.segmented)
            }

            Section {
                Button {
                    Task { await submit() }
                } label: {
                    if isLoading { ProgressView().controlSize(.small) }
                    else { Label("Express Interest", systemImage: "heart.fill") }
                }
                .disabled(selectedVenueId.isEmpty || isLoading)
                .tint(.lunaPurple)

                if let error { Text(error).foregroundColor(.red).font(.caption) }
            }

            if let result {
                Section("Result") {
                    LabeledContent("User", value: userName(result.userId))
                    LabeledContent("Venue", value: result.venueId)
                    LabeledContent("Level", value: result.level)
                    if let at = result.updatedAt { LabeledContent("Saved", value: formattedDate(at)) }
                }
            }

            Section("Level Guide") {
                ForEach([
                    ("viewed", "Browsed the venue"),
                    ("interested", "Want to go"),
                    ("planning", "Actively planning"),
                    ("confirmed", "Visit confirmed"),
                    ("attended", "Already been"),
                ], id: \.0) { level, desc in
                    HStack(spacing: 8) {
                        BadgeView(text: level, color: levelColor(level))
                        Text(desc).font(.caption).foregroundColor(.secondary)
                    }
                }
            }
        }
        .scrollContentBackground(.hidden)
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
        error = nil
        do {
            result = try await api.expressInterest(userId: selectedUser, venueId: selectedVenueId, level: selectedLevel)
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }
}

struct UserEngagementsPanel: View {
    @ObservedObject var api: APIService
    @Binding var selectedUser: String

    @State private var engagements: [VenueEngagement] = []
    @State private var isLoading = false
    @State private var error: String?

    var body: some View {
        Group {
            if isLoading {
                VStack(spacing: 12) {
                    ProgressView().tint(.lunaPurple).scaleEffect(1.2)
                    Text("Loading…").font(.caption).foregroundColor(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if engagements.isEmpty {
                VStack(spacing: 16) {
                    Image(systemName: "heart.slash")
                        .font(.system(size: 44))
                        .foregroundColor(.lunaDeepPurple)
                    Text("No Engagements").font(.headline).foregroundColor(.white)
                    Text("Express interest in venues to see history").font(.caption).foregroundColor(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                ScrollView {
                    LazyVStack(spacing: 8) {
                        ForEach(engagements) { eng in
                            HStack(spacing: 12) {
                                BadgeView(text: eng.level, color: levelColor(eng.level))
                                Text(eng.venueId).font(.subheadline).foregroundColor(.white)
                                Spacer()
                                if let at = eng.updatedAt ?? eng.createdAt {
                                    Text(formattedDate(at)).font(.caption2).foregroundColor(.secondary)
                                }
                            }
                            .padding(12)
                            .background(Color.lunaCard)
                            .clipShape(RoundedRectangle(cornerRadius: 10))
                        }
                    }
                    .padding(.horizontal)
                    .padding(.bottom, 100)
                }
            }
        }
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button { Task { await load() } } label: {
                    Image(systemName: "arrow.clockwise").foregroundColor(.lunaPurple)
                }
            }
        }
        .overlay(alignment: .top) {
            if let error { ErrorBanner(message: error).padding(.top, 4) }
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
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }
}

struct VenueEngagementsPanel: View {
    @ObservedObject var api: APIService

    @State private var venueId = "v1"
    @State private var engagements: [VenueEngagement] = []
    @State private var isLoading = false
    @State private var error: String?

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                TextField("Venue ID (e.g. v1)", text: $venueId)
                    .textFieldStyle(.roundedBorder)
                Button("Load") { Task { await load() } }
                    .buttonStyle(.borderedProminent)
                    .tint(.lunaPurple)
            }
            .padding()

            if isLoading {
                VStack(spacing: 12) {
                    ProgressView().tint(.lunaPurple).scaleEffect(1.2)
                    Text("Loading…").font(.caption).foregroundColor(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if engagements.isEmpty {
                VStack(spacing: 12) {
                    Image(systemName: "building.2.slash")
                        .font(.system(size: 44))
                        .foregroundColor(.lunaDeepPurple)
                    Text("No Data").font(.headline).foregroundColor(.white)
                    Text("Enter a venue ID and tap Load").font(.caption).foregroundColor(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                ScrollView {
                    LazyVStack(spacing: 8) {
                        ForEach(engagements) { eng in
                            HStack(spacing: 12) {
                                BadgeView(text: eng.level, color: levelColor(eng.level))
                                Text(userName(eng.userId)).font(.subheadline).foregroundColor(.white)
                                Spacer()
                                if let at = eng.updatedAt ?? eng.createdAt {
                                    Text(formattedDate(at)).font(.caption2).foregroundColor(.secondary)
                                }
                            }
                            .padding(12)
                            .background(Color.lunaCard)
                            .clipShape(RoundedRectangle(cornerRadius: 10))
                        }
                    }
                    .padding(.horizontal)
                    .padding(.bottom, 100)
                }
            }
        }
        .overlay(alignment: .top) {
            if let error { ErrorBanner(message: error).padding(.top, 60) }
        }
    }

    func load() async {
        guard !venueId.isEmpty else { return }
        isLoading = true
        error = nil
        do {
            let r = try await api.getVenueEngagements(venueId: venueId)
            engagements = r.engagements
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }
}

func levelColor(_ level: String) -> Color {
    switch level {
    case "viewed": return .gray
    case "interested": return .blue
    case "planning": return .orange
    case "confirmed": return .green
    case "attended": return .purple
    default: return .secondary
    }
}
