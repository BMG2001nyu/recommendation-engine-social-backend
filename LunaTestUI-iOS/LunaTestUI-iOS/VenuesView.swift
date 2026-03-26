import SwiftUI

struct VenuesView: View {
    @ObservedObject var api: APIService
    @Binding var selectedUser: String

    @State private var venues: [LunaVenue] = []
    @State private var total = 0
    @State private var isLoading = false
    @State private var error: String?
    @State private var selectedCategory = ""

    let categories = ["", "jazz club", "cocktail bar", "restaurant", "wine bar", "rooftop bar", "speakeasy", "gastropub"]

    var body: some View {
        NavigationStack {
            ZStack {
                Color.lunaBackground.ignoresSafeArea()

                Group {
                    if isLoading && venues.isEmpty {
                        VStack(spacing: 16) {
                            ProgressView().tint(.lunaPurple).scaleEffect(1.3)
                            Text("Loading venues…").font(.subheadline).foregroundColor(.secondary)
                        }
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                    } else if venues.isEmpty && error != nil {
                        ServerSetupCard(api: api).padding()
                            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
                            .padding(.top, 20)
                    } else if venues.isEmpty {
                        VStack(spacing: 12) {
                            Image(systemName: "building.2.slash")
                                .font(.system(size: 44))
                                .foregroundColor(.lunaDeepPurple)
                            Text("No venues found").font(.headline).foregroundColor(.white)
                            Text("Tap refresh to load").font(.caption).foregroundColor(.secondary)
                        }
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                    } else {
                        ScrollView {
                            LazyVStack(spacing: 10) {
                                if let error {
                                    ErrorBanner(message: error).padding(.horizontal)
                                }
                                ForEach(venues) { venue in
                                    NavigationLink {
                                        VenueDetailView(api: api, venue: venue, selectedUser: $selectedUser)
                                    } label: {
                                        VenueCard(venue: venue)
                                    }
                                    .buttonStyle(.plain)
                                    .padding(.horizontal)
                                }
                            }
                            .padding(.top, 8)
                            .padding(.bottom, 100)
                        }
                        .refreshable { await loadVenues() }
                    }
                }
            }
            .navigationTitle("Venues")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(.hidden, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Picker("Category", selection: $selectedCategory) {
                        Text("All").tag("")
                        ForEach(categories.dropFirst(), id: \.self) { cat in
                            Text(cat.capitalized).tag(cat)
                        }
                    }
                    .pickerStyle(.menu)
                    .tint(.lunaPurple)
                    .onChange(of: selectedCategory) { _, _ in Task { await loadVenues() } }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button { Task { await loadVenues() } } label: {
                        Image(systemName: "arrow.clockwise").foregroundColor(.lunaPurple)
                    }
                    .disabled(isLoading)
                }
            }
        }
        .task { await loadVenues() }
    }

    func loadVenues() async {
        isLoading = true
        error = nil
        do {
            let result = try await api.getVenues(category: selectedCategory.isEmpty ? nil : selectedCategory, limit: 20)
            venues = result.venues
            total = result.total
        } catch {
            if !isCancellation(error) { self.error = error.localizedDescription }
        }
        isLoading = false
    }
}

struct VenueCard: View {
    let venue: LunaVenue

    var body: some View {
        HStack(spacing: 14) {
            // Category icon
            ZStack {
                RoundedRectangle(cornerRadius: 10)
                    .fill(LinearGradient(colors: [.lunaDeepPurple, .lunaBackground], startPoint: .topLeading, endPoint: .bottomTrailing))
                    .frame(width: 46, height: 46)
                Image(systemName: categoryIcon(venue.category))
                    .font(.system(size: 20))
                    .foregroundStyle(LinearGradient(colors: [.white, .lunaPurple.opacity(0.8)], startPoint: .top, endPoint: .bottom))
            }

            VStack(alignment: .leading, spacing: 5) {
                HStack {
                    Text(venue.name)
                        .font(.subheadline).fontWeight(.semibold)
                        .foregroundColor(.white)
                    Spacer()
                    Text(priceString(venue.priceLevel))
                        .font(.caption).fontWeight(.semibold)
                        .foregroundColor(.green)
                }
                HStack(spacing: 6) {
                    BadgeView(text: venue.category, color: .lunaPurple)
                    if let ts = venue.trendingScore, ts > 0.3 {
                        BadgeView(text: "🔥 trending", color: .red)
                    }
                    Spacer()
                    HStack(spacing: 2) {
                        Image(systemName: "star.fill").foregroundColor(.yellow).font(.caption2)
                        Text(String(format: "%.1f", venue.rating)).font(.caption2).foregroundColor(.secondary)
                    }
                }
                if let vibe = venue.vibeDescription {
                    Text(vibe).font(.caption2).foregroundColor(.secondary).lineLimit(1)
                }
            }

            Image(systemName: "chevron.right").font(.caption2).foregroundColor(.secondary)
        }
        .padding(12)
        .background(Color.lunaCard)
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).strokeBorder(Color.lunaPurple.opacity(0.15), lineWidth: 0.5))
    }

    func categoryIcon(_ category: String) -> String {
        switch category {
        case "jazz club": return "music.note"
        case "cocktail bar", "wine bar": return "wineglass.fill"
        case "restaurant": return "fork.knife"
        case "rooftop bar": return "building.columns.fill"
        case "speakeasy": return "key.fill"
        case "gastropub": return "cup.and.saucer.fill"
        default: return "mappin.circle.fill"
        }
    }
}

struct VenueDetailView: View {
    @ObservedObject var api: APIService
    let venue: LunaVenue
    @Binding var selectedUser: String

    @State private var socialProof: LunaSocialProof?
    @State private var isLoadingProof = false
    @State private var proofError: String?
    @State private var selectedLevel = "interested"
    @State private var isExpressing = false
    @State private var interestMsg: String?
    @State private var interestError: String?

    var body: some View {
        ZStack {
            Color.lunaBackground.ignoresSafeArea()
            List {
                Section("Details") {
                    LabeledContent("Category", value: venue.category)
                    LabeledContent("Address", value: venue.address ?? "—")
                    LabeledContent("City", value: venue.city ?? "—")
                    LabeledContent("Rating", value: String(format: "%.1f ⭐", venue.rating))
                    LabeledContent("Price", value: priceString(venue.priceLevel))
                    if let q = venue.qualityScore {
                        LabeledContent("Quality Score", value: String(format: "%.2f", q))
                    }
                    if let t = venue.trendingScore {
                        LabeledContent("Trending", value: String(format: "%.2f", t))
                    }
                    if let e = venue.engagementCount {
                        LabeledContent("Engagements", value: "\(e)")
                    }
                    if let tags = venue.tags, !tags.isEmpty {
                        LabeledContent("Tags", value: tags.joined(separator: ", "))
                    }
                    if let vibe = venue.vibeDescription {
                        LabeledContent("Vibe", value: vibe)
                    }
                }

                Section {
                    Button {
                        Task { await loadProof() }
                    } label: {
                        Label("Load Social Proof for \(userName(selectedUser))", systemImage: "person.3.fill")
                    }
                    .disabled(isLoadingProof)
                    if isLoadingProof { ProgressView().controlSize(.small) }
                    if let err = proofError {
                        Text(err).font(.caption).foregroundColor(.red)
                    }
                } header: { Text("Social Proof") }

                if let proof = socialProof {
                    Section("Proof Data") {
                        if let trend = proof.momentumTrend { LabeledContent("Trend", value: trend) }
                        if let c = proof.interestedCount { LabeledContent("Interested", value: "\(c)") }
                        if let c = proof.planningCount { LabeledContent("Planning", value: "\(c)") }
                        if let c = proof.confirmedCount { LabeledContent("Confirmed", value: "\(c)") }
                        if let friends = proof.friendsInterested, !friends.isEmpty {
                            LabeledContent("Friends", value: friends.map { $0.name }.joined(separator: ", "))
                        }
                    }
                }

                Section("Express Interest") {
                    Picker("User", selection: $selectedUser) {
                        ForEach(seedUsers, id: \.id) { u in Text(u.name).tag(u.id) }
                    }
                    Picker("Level", selection: $selectedLevel) {
                        ForEach(interestLevels, id: \.self) { Text($0.capitalized).tag($0) }
                    }
                    Button {
                        Task { await expressInterest() }
                    } label: {
                        if isExpressing { ProgressView().controlSize(.small) }
                        else { Label("Submit", systemImage: "heart.fill") }
                    }
                    .disabled(isExpressing)
                    if let msg = interestMsg { Text(msg).font(.caption).foregroundColor(.green) }
                    if let err = interestError { Text(err).font(.caption).foregroundColor(.red) }
                }
            }
            .scrollContentBackground(.hidden)
        }
        .navigationTitle(venue.name)
        .navigationBarTitleDisplayMode(.inline)
    }

    func loadProof() async {
        isLoadingProof = true
        proofError = nil
        do {
            let result = try await api.getVenueWithSocialProof(id: venue.id, userId: selectedUser)
            socialProof = result.socialProof
        } catch {
            proofError = error.localizedDescription
        }
        isLoadingProof = false
    }

    func expressInterest() async {
        isExpressing = true
        interestMsg = nil
        interestError = nil
        do {
            let result = try await api.expressInterest(userId: selectedUser, venueId: venue.id, level: selectedLevel)
            interestMsg = "✓ Saved as '\(result.level)'"
        } catch {
            interestError = "✗ \(error.localizedDescription)"
        }
        isExpressing = false
    }
}
