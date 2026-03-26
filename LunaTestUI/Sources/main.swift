import SwiftUI

struct LunaTestApp: App {
    var body: some Scene {
        WindowGroup("Luna Social — API Tester") {
            ContentView()
                .frame(minWidth: 1060, minHeight: 720)
        }
        .windowResizability(.contentSize)
    }
}

LunaTestApp.main()
