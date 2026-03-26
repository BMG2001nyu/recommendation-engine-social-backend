import SwiftUI

@main
struct LunaTestUIApp: App {
    init() {
        // Force dark appearance globally so the window chrome matches our dark theme
        UITabBar.appearance().unselectedItemTintColor = UIColor.systemGray
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
                .preferredColorScheme(.dark)
        }
    }
}
