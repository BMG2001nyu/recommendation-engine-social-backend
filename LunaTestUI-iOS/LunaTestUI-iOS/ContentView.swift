import SwiftUI

// MARK: - Brand Colors
extension Color {
    static let lunaBackground = Color(red: 0.063, green: 0.043, blue: 0.102)
    static let lunaPurple     = Color(red: 0.55,  green: 0.25,  blue: 0.90)
    static let lunaDeepPurple = Color(red: 0.28,  green: 0.10,  blue: 0.48)
    static let lunaGold       = Color(red: 0.95,  green: 0.80,  blue: 0.40)
    static let lunaCard       = Color(red: 0.12,  green: 0.08,  blue: 0.18)
    static let lunaSurface    = Color(red: 0.16,  green: 0.10,  blue: 0.22)
}

struct ContentView: View {
    @StateObject private var api = APIService()
    @State private var selectedUser = "u1"

    var body: some View {
        // Full-screen dark background sits BEHIND the TabView so no black edges show
        ZStack {
            Color.lunaBackground.ignoresSafeArea()

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
            .tint(.lunaPurple)
        }
    }
}

// MARK: - Shared Components

struct BadgeView: View {
    let text: String
    let color: Color

    var body: some View {
        Text(text)
            .font(.caption2)
            .fontWeight(.semibold)
            .padding(.horizontal, 7)
            .padding(.vertical, 3)
            .background(color.opacity(0.15))
            .foregroundColor(color)
            .clipShape(Capsule())
    }
}

struct ErrorBanner: View {
    let message: String
    var body: some View {
        HStack(alignment: .top, spacing: 8) {
            Image(systemName: "exclamationmark.triangle.fill").foregroundColor(.red).font(.caption)
            Text(message).font(.caption).foregroundColor(.red)
            Spacer()
        }
        .padding(10)
        .background(Color.red.opacity(0.10))
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .padding(.horizontal)
    }
}

struct ServerSetupCard: View {
    @ObservedObject var api: APIService
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Label("Backend not running", systemImage: "wifi.slash")
                .font(.subheadline).fontWeight(.semibold)
                .foregroundColor(.orange)

            Text("Run this in your Mac terminal:")
                .font(.caption).foregroundColor(.secondary)

            Text("npm run dev")
                .font(.system(.caption, design: .monospaced))
                .foregroundColor(.lunaGold)
                .padding(8)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color.black.opacity(0.4))
                .clipShape(RoundedRectangle(cornerRadius: 6))

            Text("Server: \(api.baseURL)")
                .font(.caption2).foregroundColor(.secondary)
        }
        .padding(14)
        .background(Color.orange.opacity(0.07))
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(Color.orange.opacity(0.25), lineWidth: 0.5))
    }
}
