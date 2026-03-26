import SwiftUI

struct UsersView: View {
    @ObservedObject var api: APIService
    @Binding var selectedUser: String

    @State private var user: LunaUser?
    @State private var friends: [LunaUser] = []
    @State private var friendCount = 0
    @State private var isLoading = false
    @State private var error: String?

    var body: some View {
        HSplitView {
            // Left: User list
            VStack(spacing: 0) {
                HStack {
                    Text("Users").font(.headline)
                    Spacer()
                }
                .padding(.horizontal)
                .padding(.vertical, 10)

                Divider()

                List(seedUsers, id: \.id, selection: $selectedUser) { u in
                    HStack {
                        Image(systemName: "person.circle.fill")
                            .foregroundColor(.blue)
                            .font(.title3)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(u.name).font(.subheadline).fontWeight(.medium)
                            Text(u.id).font(.caption2).foregroundColor(.secondary)
                        }
                    }
                    .padding(.vertical, 2)
                    .tag(u.id)
                    .contentShape(Rectangle())
                    .onTapGesture {
                        selectedUser = u.id
                    }
                }
                .listStyle(.plain)
            }
            .frame(minWidth: 200, maxWidth: 260)

            // Right: User detail
            VStack(spacing: 0) {
                HStack {
                    Button {
                        Task { await loadUser() }
                    } label: {
                        Label("Load Profile", systemImage: "arrow.clockwise")
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(isLoading)
                    Spacer()
                }
                .padding(.horizontal)
                .padding(.vertical, 10)
                .background(Color(nsColor: .windowBackgroundColor))

                Divider()

                if let error {
                    ErrorBanner(message: error).padding()
                }

                if isLoading {
                    LoadingRow(message: "Loading…")
                } else if let user {
                    ScrollView {
                        VStack(alignment: .leading, spacing: 16) {
                            // Profile card
                            GroupBox(label: Label("Profile", systemImage: "person.circle")) {
                                Grid(alignment: .leading, horizontalSpacing: 12, verticalSpacing: 6) {
                                    GridRow {
                                        Text("Name").font(.caption).foregroundColor(.secondary)
                                        Text(user.name).font(.subheadline).fontWeight(.medium)
                                    }
                                    GridRow {
                                        Text("ID").font(.caption).foregroundColor(.secondary)
                                        Text(user.id).font(.caption2).foregroundColor(.secondary)
                                    }
                                    if let email = user.email {
                                        GridRow {
                                            Text("Email").font(.caption).foregroundColor(.secondary)
                                            Text(email).font(.caption)
                                        }
                                    }
                                    if let city = user.city {
                                        GridRow {
                                            Text("City").font(.caption).foregroundColor(.secondary)
                                            Text(city).font(.caption)
                                        }
                                    }
                                    if let lat = user.lat, let lng = user.lng {
                                        GridRow {
                                            Text("Location").font(.caption).foregroundColor(.secondary)
                                            Text(String(format: "%.4f, %.4f", lat, lng)).font(.caption2)
                                        }
                                    }
                                    if let at = user.createdAt {
                                        GridRow {
                                            Text("Joined").font(.caption).foregroundColor(.secondary)
                                            Text(formattedDate(at)).font(.caption2)
                                        }
                                    }
                                }
                                .padding(.vertical, 4)
                            }

                            // Friends
                            GroupBox(label: Label("Friends (\(friendCount))", systemImage: "person.2")) {
                                if friends.isEmpty {
                                    Text("No friends loaded").font(.caption).foregroundColor(.secondary)
                                } else {
                                    ForEach(friends) { friend in
                                        HStack {
                                            Image(systemName: "person.circle.fill")
                                                .foregroundColor(.purple)
                                                .font(.subheadline)
                                            VStack(alignment: .leading, spacing: 1) {
                                                Text(friend.name).font(.subheadline)
                                                Text(friend.id).font(.caption2).foregroundColor(.secondary)
                                            }
                                            Spacer()
                                            if let city = friend.city {
                                                Text(city).font(.caption2).foregroundColor(.secondary)
                                            }
                                        }
                                        .padding(.vertical, 2)
                                        Divider()
                                    }
                                }
                            }
                        }
                        .padding()
                    }
                } else {
                    ContentUnavailableView(
                        "No Profile",
                        systemImage: "person.slash",
                        description: Text("Select a user and tap Load Profile")
                    )
                }
            }
            .frame(minWidth: 400)
        }
        .onChange(of: selectedUser) { _, _ in Task { await loadUser() } }
        .task { await loadUser() }
    }

    func loadUser() async {
        isLoading = true
        error = nil
        do {
            async let u = api.getUser(userId: selectedUser)
            async let f = api.getUserFriends(userId: selectedUser)
            let (userResult, friendsResult) = try await (u, f)
            user = userResult
            friends = friendsResult.friends
            friendCount = friendsResult.count
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }
}
