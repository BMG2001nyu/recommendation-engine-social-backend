import SwiftUI

struct ContentView: View {
    @StateObject private var api = APIService()
    @State private var selectedUser = "u1"

    var body: some View {
        TabView {
            FeedView(api: api, selectedUser: $selectedUser)
                .tabItem { Label("Feed", systemImage: "house.fill") }

            VenuesView(api: api, selectedUser: $selectedUser)
                .tabItem { Label("Venues", systemImage: "building.2.fill") }

            PlansView(api: api, selectedUser: $selectedUser)
                .tabItem { Label("Plans", systemImage: "calendar") }

            InterestsView(api: api, selectedUser: $selectedUser)
                .tabItem { Label("Interests", systemImage: "heart.fill") }

            UsersView(api: api, selectedUser: $selectedUser)
                .tabItem { Label("Users", systemImage: "person.2.fill") }

            SettingsView(api: api, selectedUser: $selectedUser)
                .tabItem { Label("Dev", systemImage: "wrench.and.screwdriver") }
        }
        .padding(8)
    }
}

// MARK: - Shared User Picker
struct UserPickerRow: View {
    @Binding var selectedUser: String
    let label: String

    var body: some View {
        HStack {
            Text(label)
                .font(.subheadline)
                .foregroundColor(.secondary)
            Picker("", selection: $selectedUser) {
                ForEach(seedUsers, id: \.id) { u in
                    Text("\(u.id) — \(u.name)").tag(u.id)
                }
            }
            .pickerStyle(.menu)
            .frame(maxWidth: 220)
        }
    }
}

// MARK: - Status Badge
struct BadgeView: View {
    let text: String
    let color: Color

    var body: some View {
        Text(text)
            .font(.caption2)
            .fontWeight(.semibold)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(color.opacity(0.15))
            .foregroundColor(color)
            .clipShape(Capsule())
            .overlay(Capsule().stroke(color.opacity(0.4), lineWidth: 0.5))
    }
}

// MARK: - Error Banner
struct ErrorBanner: View {
    let message: String

    var body: some View {
        HStack {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundColor(.red)
            Text(message)
                .font(.caption)
                .foregroundColor(.red)
                .lineLimit(3)
            Spacer()
        }
        .padding(10)
        .background(Color.red.opacity(0.08))
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }
}

// MARK: - Loading Overlay
struct LoadingRow: View {
    let message: String
    var body: some View {
        HStack {
            ProgressView()
                .controlSize(.small)
            Text(message)
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .padding()
    }
}
