import SwiftUI

struct FeedView: View {
    @ObservedObject var api: APIService
    @Binding var selectedUser: String

    @State private var feed: FeedResponse?
    @State private var isLoading = false
    @State private var error: String?

    var body: some View {
        NavigationStack {
            ZStack {
                Color.lunaBackground.ignoresSafeArea()

                ScrollView {
                    VStack(spacing: 12) {
                        // Error / setup card
                        if let error, feed == nil {
                            ServerSetupCard(api: api)
                                .padding(.horizontal)
                                .padding(.top, 8)
                        } else if let error {
                            ErrorBanner(message: error)
                        }

                        // Loading state
                        if isLoading && feed == nil {
                            VStack(spacing: 10) {
                                ProgressView().tint(.lunaPurple).scaleEffect(1.2)
                                Text("Generating recommendations…")
                                    .font(.caption).foregroundColor(.secondary)
                            }
                            .frame(maxWidth: .infinity)
                            .padding(40)
                        }

                        // Feed content
                        if let feed {
                            HStack {
                                BadgeView(
                                    text: feed.strategy.replacingOccurrences(of: "_", with: " ").uppercased(),
                                    color: strategyColor(feed.strategy)
                                )
                                Text("\(feed.count) venues")
                                    .font(.caption).foregroundColor(.secondary)
                                Spacer()
                            }
                            .padding(.horizontal)

                            LazyVStack(spacing: 10) {
                                ForEach(Array(feed.recommendations.enumerated()), id: \.element.id) { index, rec in
                                    NavigationLink {
                                        RecommendationDetailView(rec: rec, api: api, selectedUser: $selectedUser)
                                    } label: {
                                        RecommendationCard(rec: rec, rank: index + 1)
                                    }
                                    .buttonStyle(.plain)
                                    .padding(.horizontal)
                                }
                            }
                        }

                        // Empty state (no error, no feed, not loading)
                        if !isLoading && feed == nil && error == nil {
                            VStack(spacing: 10) {
                                Image(systemName: "moon.zzz")
                                    .font(.system(size: 36))
                                    .foregroundColor(.lunaDeepPurple)
                                Text("Pull down to load")
                                    .font(.caption).foregroundColor(.secondary)
                            }
                            .frame(maxWidth: .infinity)
                            .padding(40)
                        }
                    }
                    .padding(.bottom, 100)
                }
                .refreshable { await loadFeed() }
            }
            .navigationTitle("Luna Social")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Picker("", selection: $selectedUser) {
                        ForEach(seedUsers, id: \.id) { u in
                            Text(u.name).tag(u.id)
                        }
                    }
                    .pickerStyle(.menu)
                    .tint(.lunaPurple)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        Task { await loadFeed() }
                    } label: {
                        Image(systemName: "arrow.clockwise")
                            .foregroundColor(.lunaPurple)
                    }
                    .disabled(isLoading)
                }
            }
            .toolbarBackground(.hidden, for: .navigationBar)
        }
        .task { await loadFeed() }
        .onChange(of: selectedUser) { _, _ in Task { await loadFeed() } }
    }

    func loadFeed() async {
        isLoading = true
        error = nil
        do {
            feed = try await api.getFeed(userId: selectedUser, limit: 10)
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }
}

// MARK: - Recommendation Card

struct RecommendationCard: View {
    let rec: Recommendation
    let rank: Int

    var body: some View {
        HStack(spacing: 12) {
            // Rank
            Text("\(rank)")
                .font(.caption).fontWeight(.bold)
                .foregroundColor(rankColor)
                .frame(width: 24, alignment: .center)

            // Info
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(rec.venue.name)
                        .font(.subheadline).fontWeight(.semibold)
                        .foregroundColor(.white)
                    Spacer()
                    if let score = rec.score?.overall {
                        Text(String(format: "%.2f", score))
                            .font(.caption2).fontWeight(.semibold)
                            .foregroundColor(.lunaGold)
                    }
                }
                HStack(spacing: 6) {
                    Text(rec.venue.category)
                        .font(.caption2).foregroundColor(.secondary)
                    Text("·")
                        .font(.caption2).foregroundColor(.secondary)
                    Text(priceString(rec.venue.priceLevel))
                        .font(.caption2).foregroundColor(.green)
                    Text("·")
                        .font(.caption2).foregroundColor(.secondary)
                    Image(systemName: "star.fill")
                        .font(.caption2).foregroundColor(.yellow)
                    Text(String(format: "%.1f", rec.venue.rating))
                        .font(.caption2).foregroundColor(.secondary)
                }
                if let proof = rec.socialProof, let trend = proof.momentumTrend {
                    HStack(spacing: 3) {
                        Image(systemName: "flame.fill").font(.caption2)
                        Text(trend.capitalized).font(.caption2)
                    }
                    .foregroundColor(momentumColor(trend))
                }
            }

            Image(systemName: "chevron.right")
                .font(.caption2).foregroundColor(.secondary.opacity(0.5))
        }
        .padding(14)
        .background(Color.lunaCard)
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    private var rankColor: Color {
        switch rank {
        case 1: return .lunaGold
        case 2: return Color(white: 0.7)
        case 3: return Color(red: 0.8, green: 0.5, blue: 0.2)
        default: return .secondary
        }
    }
}

// MARK: - Detail View

struct RecommendationDetailView: View {
    let rec: Recommendation
    @ObservedObject var api: APIService
    @Binding var selectedUser: String

    @State private var interestLevel = "interested"
    @State private var interestMsg: String?
    @State private var isExpressing = false

    var body: some View {
        ZStack {
            Color.lunaBackground.ignoresSafeArea()
            List {
                Section("Venue") {
                    LabeledContent("Name", value: rec.venue.name)
                    LabeledContent("Category", value: rec.venue.category)
                    LabeledContent("Address", value: rec.venue.address ?? "—")
                    LabeledContent("Rating", value: String(format: "%.1f ⭐", rec.venue.rating))
                    LabeledContent("Price", value: priceString(rec.venue.priceLevel))
                    if let vibe = rec.venue.vibeDescription {
                        LabeledContent("Vibe", value: vibe)
                    }
                }

                if let score = rec.score {
                    Section("Scores") {
                        LabeledContent("Overall",  value: String(format: "%.3f", score.overall ?? 0))
                        LabeledContent("Venue",    value: String(format: "%.3f", score.venueMatch ?? 0))
                        LabeledContent("Social",   value: String(format: "%.3f", score.socialScore ?? 0))
                        LabeledContent("Temporal", value: String(format: "%.3f", score.temporalScore ?? 0))
                    }
                }

                if let slot = rec.suggestedTime {
                    Section("Best Time") {
                        LabeledContent("Start",      value: formattedDate(slot.startTime))
                        LabeledContent("End",        value: formattedDate(slot.endTime))
                        LabeledContent("Confidence", value: "\(Int(slot.confidence * 100))%")
                        if let n = slot.availableFriendCount { LabeledContent("Friends Free", value: "\(n)") }
                        if let r = slot.reasoning { LabeledContent("Reason", value: r) }
                    }
                }

                if let people = rec.suggestedPeople, !people.isEmpty {
                    Section("Suggested Friends") {
                        ForEach(people) { p in
                            HStack {
                                Text(p.name ?? p.userId)
                                Spacer()
                                if let s = p.compatibilityScore {
                                    Text("\(Int(s * 100))%").font(.caption).foregroundColor(.secondary)
                                }
                            }
                        }
                    }
                }

                if let proof = rec.socialProof {
                    Section("Social Proof") {
                        if let t = proof.momentumTrend   { LabeledContent("Trend",     value: t) }
                        if let c = proof.interestedCount { LabeledContent("Interested", value: "\(c)") }
                        if let c = proof.planningCount   { LabeledContent("Planning",   value: "\(c)") }
                        if let c = proof.confirmedCount  { LabeledContent("Confirmed",  value: "\(c)") }
                    }
                }

                Section("Express Interest") {
                    Picker("Level", selection: $interestLevel) {
                        ForEach(interestLevels, id: \.self) { Text($0.capitalized).tag($0) }
                    }
                    Button {
                        Task { await express() }
                    } label: {
                        if isExpressing { ProgressView().controlSize(.small) }
                        else { Label("Save as \(userName(selectedUser))", systemImage: "heart.fill") }
                    }
                    if let msg = interestMsg {
                        Text(msg).font(.caption).foregroundColor(.green)
                    }
                }
            }
            .scrollContentBackground(.hidden)
        }
        .navigationTitle(rec.venue.name)
        .navigationBarTitleDisplayMode(.inline)
    }

    func express() async {
        isExpressing = true
        interestMsg = nil
        do {
            let r = try await api.expressInterest(userId: selectedUser, venueId: rec.venue.id, level: interestLevel)
            interestMsg = "✓ Saved as '\(r.level)'"
        } catch {
            interestMsg = "✗ \(error.localizedDescription)"
        }
        isExpressing = false
    }
}
