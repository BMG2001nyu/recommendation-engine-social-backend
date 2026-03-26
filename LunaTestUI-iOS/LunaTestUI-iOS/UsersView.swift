import SwiftUI

struct UsersView: View {
    @ObservedObject var api: APIService
    @Binding var selectedUser: String

    var body: some View {
        NavigationStack {
            ZStack {
                Color.lunaBackground.ignoresSafeArea()
                ScrollView {
                    LazyVStack(spacing: 10) {
                        ForEach(seedUsers, id: \.id) { u in
                            NavigationLink {
                                UserDetailView(api: api, userId: u.id)
                            } label: {
                                UserCard(user: u, isSelected: u.id == selectedUser)
                            }
                            .buttonStyle(.plain)
                            .padding(.horizontal)
                        }
                    }
                    .padding(.top, 8)
                    .padding(.bottom, 100)
                }
            }
            .navigationTitle("Users")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(.hidden, for: .navigationBar)
        }
    }
}

struct UserCard: View {
    let user: (id: String, name: String)
    let isSelected: Bool

    var body: some View {
        HStack(spacing: 14) {
            ZStack {
                Circle()
                    .fill(
                        LinearGradient(
                            colors: isSelected ? [.lunaPurple, .lunaDeepPurple] : [Color.lunaCard, Color.lunaBackground],
                            startPoint: .topLeading, endPoint: .bottomTrailing
                        )
                    )
                    .frame(width: 46, height: 46)
                Text(String(user.name.prefix(1)))
                    .font(.title3).fontWeight(.bold)
                    .foregroundColor(isSelected ? .white : .secondary)
            }

            VStack(alignment: .leading, spacing: 3) {
                Text(user.name)
                    .font(.subheadline).fontWeight(.semibold)
                    .foregroundColor(.white)
                Text(user.id)
                    .font(.caption2).foregroundColor(.secondary)
            }

            Spacer()

            if isSelected {
                BadgeView(text: "active", color: .lunaPurple)
            }

            Image(systemName: "chevron.right").font(.caption2).foregroundColor(.secondary)
        }
        .padding(12)
        .background(Color.lunaCard)
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .strokeBorder(isSelected ? Color.lunaPurple.opacity(0.5) : Color.lunaPurple.opacity(0.1), lineWidth: isSelected ? 1 : 0.5)
        )
    }
}

struct UserDetailView: View {
    @ObservedObject var api: APIService
    let userId: String

    @State private var user: LunaUser?
    @State private var friends: [LunaUser] = []
    @State private var isLoading = false
    @State private var error: String?

    var body: some View {
        ZStack {
            Color.lunaBackground.ignoresSafeArea()
            Group {
                if isLoading {
                    VStack(spacing: 12) {
                        ProgressView().tint(.lunaPurple).scaleEffect(1.2)
                        Text("Loading…").font(.caption).foregroundColor(.secondary)
                    }
                } else if let user {
                    List {
                        Section {
                            // Avatar header
                            HStack {
                                Spacer()
                                VStack(spacing: 8) {
                                    ZStack {
                                        Circle()
                                            .fill(LinearGradient(colors: [.lunaPurple, .lunaDeepPurple], startPoint: .topLeading, endPoint: .bottomTrailing))
                                            .frame(width: 72, height: 72)
                                        Text(String(user.name.prefix(1)))
                                            .font(.largeTitle).fontWeight(.bold)
                                            .foregroundColor(.white)
                                    }
                                    Text(user.name)
                                        .font(.title3).fontWeight(.semibold)
                                        .foregroundColor(.white)
                                    Text(user.id)
                                        .font(.caption).foregroundColor(.secondary)
                                }
                                Spacer()
                            }
                            .listRowBackground(Color.lunaCard)
                            .padding(.vertical, 8)
                        }

                        Section("Profile") {
                            if let email = user.email { LabeledContent("Email", value: email) }
                            if let city = user.city { LabeledContent("City", value: city) }
                            if let lat = user.lat, let lng = user.lng {
                                LabeledContent("Location", value: String(format: "%.4f, %.4f", lat, lng))
                            }
                            if let at = user.createdAt { LabeledContent("Joined", value: formattedDate(at)) }
                        }

                        Section("Friends (\(friends.count))") {
                            if friends.isEmpty {
                                Text("No friends data").foregroundColor(.secondary)
                            } else {
                                ForEach(friends) { friend in
                                    HStack(spacing: 10) {
                                        ZStack {
                                            Circle()
                                                .fill(Color.lunaPurple.opacity(0.3))
                                                .frame(width: 32, height: 32)
                                            Text(String(friend.name.prefix(1)))
                                                .font(.caption).fontWeight(.bold)
                                                .foregroundColor(.lunaPurple)
                                        }
                                        VStack(alignment: .leading, spacing: 2) {
                                            Text(friend.name).font(.subheadline)
                                            Text(friend.id).font(.caption2).foregroundColor(.secondary)
                                        }
                                        Spacer()
                                        if let city = friend.city {
                                            Text(city).font(.caption2).foregroundColor(.secondary)
                                        }
                                    }
                                }
                            }
                        }
                    }
                    .scrollContentBackground(.hidden)
                } else if let error {
                    VStack(spacing: 12) {
                        Image(systemName: "exclamationmark.triangle")
                            .font(.system(size: 44))
                            .foregroundColor(.orange)
                        Text("Could not load user").font(.headline).foregroundColor(.white)
                        Text(error).font(.caption).foregroundColor(.secondary).multilineTextAlignment(.center)
                    }
                    .padding()
                }
            }
        }
        .navigationTitle(user?.name ?? userName(userId))
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
    }

    func load() async {
        isLoading = true
        error = nil
        do {
            async let u = api.getUser(userId: userId)
            async let f = api.getUserFriends(userId: userId)
            let (userResult, friendsResult) = try await (u, f)
            user = userResult
            friends = friendsResult.friends
        } catch {
            if !isCancellation(error) { self.error = error.localizedDescription }
        }
        isLoading = false
    }
}
