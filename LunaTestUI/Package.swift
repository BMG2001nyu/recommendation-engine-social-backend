// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "LunaTestUI",
    platforms: [.macOS(.v14)],
    targets: [
        .executableTarget(
            name: "LunaTestUI",
            path: "Sources"
        ),
    ]
)
