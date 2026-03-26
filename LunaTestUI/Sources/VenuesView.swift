import SwiftUI

struct VenuesView: View {
    @ObservedObject var api: APIService
    @Binding var selectedUser: String

    @State private var venues: [LunaVenue] = []
    @State private var total = 0
    @State private var isLoading = false
    @State private var error: String?
    @State private var searchCategory = ""
    @State private var selectedVenue: LunaVenue?
    @State private var showDetail = false

    let categories = ["", "jazz club", "cocktail bar", "restaurant", "wine bar", "rooftop bar", "speakeasy", "gastropub"]

    var body: some View {
        HSplitView {
            // Left: Venue list
            VStack(spacing: 0) {
                HStack(spacing: 10) {
                    Picker("Category", selection: $searchCategory) {
                        Text("All Categories").tag("")
                        ForEach(categories.dropFirst(), id: \.self) { cat in
                            Text(cat.capitalized).tag(cat)
                        }
                    }
                    .pickerStyle(.menu)
                    .frame(maxWidth: 200)

                    Spacer()

                    Button {
                        Task { await loadVenues() }
                    } label: {
                        Label("Load", systemImage: "arrow.clockwise")
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(isLoading)
                }
                .padding(.horizontal)
                .padding(.vertical, 10)
                .background(Color(nsColor: .windowBackgroundColor))

                Divider()

                if let error {
                    ErrorBanner(message: error).padding()
                }

                if isLoading {
                    LoadingRow(message: "Loading venues…")
                } else {
                    HStack {
                        Text("\(total) venues")
                            .font(.caption)
                            .foregroundColor(.secondary)
                        Spacer()
                    }
                    .padding(.horizontal)
                    .padding(.vertical, 4)

                    List(venues, selection: $selectedVenue) { venue in
                        VenueListRow(venue: venue)
                            .tag(venue)
                            .contentShape(Rectangle())
                            .onTapGesture {
                                selectedVenue = venue
                            }
                    }
                    .listStyle(.plain)
                }
            }
            .frame(minWidth: 300, maxWidth: 380)

            // Right: Venue detail
            if let venue = selectedVenue {
                VenueDetailView(api: api, venue: venue, selectedUser: $selectedUser)
                    .frame(minWidth: 380)
            } else {
                ContentUnavailableView(
                    "Select a Venue",
                    systemImage: "building.2",
                    description: Text("Tap a venue to see details and express interest")
                )
                .frame(minWidth: 380)
            }
        }
        .task { await loadVenues() }
    }

    func loadVenues() async {
        isLoading = true
        error = nil
        do {
            let category: String? = searchCategory.isEmpty ? nil : searchCategory
            let result = try await api.getVenues(category: category, limit: 20)
            venues = result.venues
            total = result.total
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }
}

struct VenueListRow: View {
    let venue: LunaVenue

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(venue.name)
                    .font(.subheadline)
                    .fontWeight(.medium)
                Spacer()
                Text(priceString(venue.priceLevel))
                    .foregroundColor(.green)
                    .font(.caption)
                HStack(spacing: 2) {
                    Image(systemName: "star.fill")
                        .foregroundColor(.yellow)
                        .font(.caption2)
                    Text(String(format: "%.1f", venue.rating))
                        .font(.caption2)
                }
            }
            HStack(spacing: 6) {
                BadgeView(text: venue.category, color: .blue)
                if let ts = venue.trendingScore, ts > 0.3 {
                    BadgeView(text: "trending", color: .red)
                }
            }
        }
        .padding(.vertical, 3)
    }
}

struct VenueDetailView: View {
    @ObservedObject var api: APIService
    let venue: LunaVenue
    @Binding var selectedUser: String

    @State private var detail: VenueDetailResponse?
    @State private var isLoadingProof = false
    @State private var proofError: String?
    @State private var selectedLevel = "interested"

    @State private var isExpressingInterest = false
    @State private var interestSuccess: String?
    @State private var interestError: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                // Venue header
                VStack(alignment: .leading, spacing: 6) {
                    Text(venue.name)
                        .font(.title2)
                        .fontWeight(.bold)
                    HStack(spacing: 10) {
                        BadgeView(text: venue.category, color: .blue)
                        Text(priceString(venue.priceLevel))
                            .foregroundColor(.green)
                            .fontWeight(.semibold)
                        HStack(spacing: 3) {
                            Image(systemName: "star.fill").foregroundColor(.yellow)
                            Text(String(format: "%.1f", venue.rating))
                        }
                        .font(.subheadline)
                    }
                    if let vibe = venue.vibeDescription {
                        Text(vibe)
                            .font(.caption)
                            .foregroundColor(.secondary)
                            .italic()
                    }
                }

                Divider()

                // Info grid
                Grid(alignment: .leading, horizontalSpacing: 12, verticalSpacing: 8) {
                    GridRow {
                        Label("Address", systemImage: "mappin")
                            .font(.caption).foregroundColor(.secondary)
                        Text(venue.address ?? "—").font(.caption)
                    }
                    GridRow {
                        Label("City", systemImage: "building.2")
                            .font(.caption).foregroundColor(.secondary)
                        Text(venue.city ?? "—").font(.caption)
                    }
                    GridRow {
                        Label("Quality", systemImage: "trophy")
                            .font(.caption).foregroundColor(.secondary)
                        Text(String(format: "%.2f", venue.qualityScore ?? 0)).font(.caption)
                    }
                    GridRow {
                        Label("Trending", systemImage: "chart.line.uptrend.xyaxis")
                            .font(.caption).foregroundColor(.secondary)
                        Text(String(format: "%.2f", venue.trendingScore ?? 0)).font(.caption)
                    }
                    GridRow {
                        Label("Engagements", systemImage: "heart")
                            .font(.caption).foregroundColor(.secondary)
                        Text("\(venue.engagementCount ?? 0)").font(.caption)
                    }
                    if let tags = venue.tags, !tags.isEmpty {
                        GridRow {
                            Label("Tags", systemImage: "tag")
                                .font(.caption).foregroundColor(.secondary)
                            HStack {
                                ForEach(tags.prefix(5), id: \.self) { tag in
                                    BadgeView(text: tag, color: .gray)
                                }
                            }
                        }
                    }
                }

                Divider()

                // Social proof section
                GroupBox(label: Label("Social Proof", systemImage: "person.3.fill")) {
                    VStack(alignment: .leading, spacing: 8) {
                        UserPickerRow(selectedUser: $selectedUser, label: "As user:")
                        Button {
                            Task { await loadSocialProof() }
                        } label: {
                            Label("Load Social Proof", systemImage: "magnifyingglass")
                        }
                        .buttonStyle(.bordered)

                        if isLoadingProof {
                            ProgressView().controlSize(.small)
                        }
                        if let err = proofError {
                            Text(err).font(.caption).foregroundColor(.red)
                        }
                        if let d = detail, let proof = d.socialProof {
                            SocialProofPanel(proof: proof)
                        }
                    }
                    .padding(.vertical, 4)
                }

                Divider()

                // Express interest
                GroupBox(label: Label("Express Interest", systemImage: "heart")) {
                    VStack(alignment: .leading, spacing: 8) {
                        UserPickerRow(selectedUser: $selectedUser, label: "As user:")
                        HStack {
                            Text("Level:").font(.caption).foregroundColor(.secondary)
                            Picker("Level", selection: $selectedLevel) {
                                ForEach(interestLevels, id: \.self) { level in
                                    Text(level.capitalized).tag(level)
                                }
                            }
                            .pickerStyle(.segmented)
                        }
                        HStack {
                            Button {
                                Task { await expressInterest() }
                            } label: {
                                Label("Submit", systemImage: "heart.fill")
                            }
                            .buttonStyle(.borderedProminent)
                            .disabled(isExpressingInterest)

                            if let msg = interestSuccess {
                                Label(msg, systemImage: "checkmark.circle.fill")
                                    .font(.caption).foregroundColor(.green)
                            }
                            if let err = interestError {
                                Text(err).font(.caption).foregroundColor(.red)
                            }
                        }
                    }
                    .padding(.vertical, 4)
                }
            }
            .padding()
        }
    }

    func loadSocialProof() async {
        isLoadingProof = true
        proofError = nil
        do {
            detail = try await api.getVenueWithSocialProof(id: venue.id, userId: selectedUser)
        } catch {
            proofError = error.localizedDescription
        }
        isLoadingProof = false
    }

    func expressInterest() async {
        isExpressingInterest = true
        interestSuccess = nil
        interestError = nil
        do {
            let result = try await api.expressInterest(userId: selectedUser, venueId: venue.id, level: selectedLevel)
            interestSuccess = "Saved as '\(result.level)'"
        } catch {
            interestError = error.localizedDescription
        }
        isExpressingInterest = false
    }
}

struct SocialProofPanel: View {
    let proof: LunaSocialProof

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 16) {
                if let trend = proof.momentumTrend {
                    HStack(spacing: 4) {
                        Image(systemName: "flame.fill")
                        Text(trend.uppercased())
                    }
                    .font(.caption)
                    .foregroundColor(momentumColor(trend))
                }
                if let c = proof.interestedCount { Label("\(c) interested", systemImage: "eye").font(.caption2) }
                if let c = proof.planningCount { Label("\(c) planning", systemImage: "calendar").font(.caption2) }
                if let c = proof.confirmedCount { Label("\(c) confirmed", systemImage: "checkmark").font(.caption2) }
            }
            if let friends = proof.friendsInterested, !friends.isEmpty {
                HStack(spacing: 4) {
                    Text("Friends interested:").font(.caption2).foregroundColor(.secondary)
                    ForEach(friends.prefix(4)) { f in
                        BadgeView(text: f.name, color: .purple)
                    }
                }
            }
            if let friends = proof.friendsConfirmed, !friends.isEmpty {
                HStack(spacing: 4) {
                    Text("Friends confirmed:").font(.caption2).foregroundColor(.secondary)
                    ForEach(friends.prefix(4)) { f in
                        BadgeView(text: f.name, color: .green)
                    }
                }
            }
        }
    }
}
