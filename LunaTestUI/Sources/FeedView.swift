import SwiftUI

struct FeedView: View {
    @ObservedObject var api: APIService
    @Binding var selectedUser: String

    @State private var feed: FeedResponse?
    @State private var isLoading = false
    @State private var error: String?
    @State private var limit = 10

    var body: some View {
        VStack(spacing: 0) {
            // Toolbar
            HStack(spacing: 16) {
                UserPickerRow(selectedUser: $selectedUser, label: "User:")
                Divider().frame(height: 20)
                Stepper("Limit: \(limit)", value: $limit, in: 1...20)
                    .frame(maxWidth: 160)
                Spacer()
                Button {
                    Task { await loadFeed() }
                } label: {
                    Label("Get Feed", systemImage: "arrow.clockwise")
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
                Spacer()
                LoadingRow(message: "Generating recommendations…")
                Spacer()
            } else if let feed {
                // Strategy header
                HStack(spacing: 12) {
                    BadgeView(text: feed.strategy.replacingOccurrences(of: "_", with: " ").uppercased(),
                              color: strategyColor(feed.strategy))
                    Text("\(feed.count) recommendations")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    Spacer()
                    Text("Generated \(formattedDate(feed.generatedAt))")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
                .padding(.horizontal)
                .padding(.vertical, 8)

                Divider()

                List(feed.recommendations) { rec in
                    RecommendationRow(rec: rec)
                        .listRowSeparator(.visible)
                }
                .listStyle(.plain)
            } else {
                ContentUnavailableView(
                    "No Feed Yet",
                    systemImage: "house",
                    description: Text("Select a user and tap Get Feed")
                )
            }
        }
        .navigationTitle("Recommendation Feed")
    }

    func loadFeed() async {
        isLoading = true
        error = nil
        do {
            feed = try await api.getFeed(userId: selectedUser, limit: limit)
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }
}

// MARK: - Recommendation Row
struct RecommendationRow: View {
    let rec: Recommendation
    @State private var expanded = false

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Header
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 3) {
                    Text(rec.venue.name)
                        .font(.headline)
                    HStack(spacing: 6) {
                        Text(rec.venue.category)
                            .font(.caption)
                            .foregroundColor(.secondary)
                        Text("·")
                            .foregroundColor(.secondary)
                        Text(rec.venue.city ?? "")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
                Spacer()
                // Score
                if let score = rec.score {
                    VStack(alignment: .trailing, spacing: 2) {
                        Text(String(format: "%.2f", score.overall ?? 0))
                            .font(.title2)
                            .fontWeight(.bold)
                            .foregroundColor(.orange)
                        Text("score")
                            .font(.caption2)
                            .foregroundColor(.secondary)
                    }
                }
                // Price + rating
                VStack(alignment: .trailing, spacing: 2) {
                    Text(priceString(rec.venue.priceLevel))
                        .foregroundColor(.green)
                        .fontWeight(.semibold)
                    HStack(spacing: 2) {
                        Image(systemName: "star.fill")
                            .foregroundColor(.yellow)
                            .font(.caption)
                        Text(String(format: "%.1f", rec.venue.rating))
                            .font(.caption)
                    }
                }
                .frame(width: 40)
            }

            // Social proof
            if let proof = rec.socialProof {
                HStack(spacing: 10) {
                    if let trend = proof.momentumTrend {
                        HStack(spacing: 3) {
                            Image(systemName: trend == "hot" || trend == "peaking" ? "flame.fill" : "chart.line.uptrend.xyaxis")
                                .font(.caption)
                            Text(trend)
                                .font(.caption)
                        }
                        .foregroundColor(momentumColor(trend))
                    }
                    if let count = proof.interestedCount, count > 0 {
                        Text("\(count) interested")
                            .font(.caption2)
                            .foregroundColor(.secondary)
                    }
                    if let friends = proof.friendsInterested, !friends.isEmpty {
                        HStack(spacing: 3) {
                            Image(systemName: "person.fill")
                                .font(.caption2)
                            Text(friends.prefix(2).map { $0.name }.joined(separator: ", "))
                                .font(.caption2)
                        }
                        .foregroundColor(.purple)
                    }
                }
            }

            // Suggested time
            if let slot = rec.suggestedTime {
                HStack(spacing: 6) {
                    Image(systemName: "clock.fill")
                        .font(.caption)
                        .foregroundColor(.blue)
                    Text(formattedDate(slot.startTime))
                        .font(.caption)
                    Text("·")
                        .foregroundColor(.secondary)
                    Text("\(Int(slot.confidence * 100))% confidence")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                    if let friends = slot.availableFriendCount, friends > 0 {
                        Text("· \(friends) friends free")
                            .font(.caption2)
                            .foregroundColor(.green)
                    }
                }
            }

            // Suggested people
            if let people = rec.suggestedPeople, !people.isEmpty {
                HStack(spacing: 6) {
                    Image(systemName: "person.2.fill")
                        .font(.caption)
                        .foregroundColor(.purple)
                    ForEach(people.prefix(4)) { p in
                        HStack(spacing: 2) {
                            Text(p.name ?? p.userId)
                                .font(.caption2)
                            if let score = p.compatibilityScore {
                                Text("(\(Int(score * 100))%)")
                                    .font(.caption2)
                                    .foregroundColor(.secondary)
                            }
                        }
                        .padding(.horizontal, 5)
                        .padding(.vertical, 2)
                        .background(Color.purple.opacity(0.08))
                        .clipShape(Capsule())
                    }
                }
            }

            // Score breakdown (expandable)
            if let score = rec.score {
                DisclosureGroup("Score breakdown", isExpanded: $expanded) {
                    Grid(alignment: .leading, horizontalSpacing: 16, verticalSpacing: 4) {
                        GridRow {
                            Text("Venue Match").font(.caption2).foregroundColor(.secondary)
                            ScoreBar(value: score.venueMatch ?? 0)
                        }
                        GridRow {
                            Text("Social Score").font(.caption2).foregroundColor(.secondary)
                            ScoreBar(value: score.socialScore ?? 0)
                        }
                        GridRow {
                            Text("Temporal").font(.caption2).foregroundColor(.secondary)
                            ScoreBar(value: score.temporalScore ?? 0)
                        }
                        GridRow {
                            Text("Freshness").font(.caption2).foregroundColor(.secondary)
                            ScoreBar(value: score.freshnessBonus ?? 0)
                        }
                    }
                    .padding(.top, 4)
                }
                .font(.caption)
                .tint(.secondary)
            }
        }
        .padding(.vertical, 6)
    }
}

struct ScoreBar: View {
    let value: Double
    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                RoundedRectangle(cornerRadius: 3)
                    .fill(Color.gray.opacity(0.15))
                RoundedRectangle(cornerRadius: 3)
                    .fill(Color.orange.opacity(0.7))
                    .frame(width: geo.size.width * value)
            }
        }
        .frame(width: 100, height: 8)
    }
}
