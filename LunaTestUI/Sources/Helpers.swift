import Foundation
import SwiftUI

func formattedDate(_ iso: String?) -> String {
    guard let iso else { return "—" }
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    if let date = formatter.date(from: iso) {
        let out = DateFormatter()
        out.dateStyle = .medium
        out.timeStyle = .short
        return out.string(from: date)
    }
    // Try without fractional seconds
    formatter.formatOptions = [.withInternetDateTime]
    if let date = formatter.date(from: iso) {
        let out = DateFormatter()
        out.dateStyle = .medium
        out.timeStyle = .short
        return out.string(from: date)
    }
    return iso
}

func priceString(_ level: Int) -> String {
    String(repeating: "$", count: max(1, min(4, level)))
}

func momentumColor(_ trend: String?) -> Color {
    switch trend {
    case "hot": return .red
    case "peaking": return .orange
    case "warming": return .yellow
    default: return .gray
    }
}

func strategyColor(_ strategy: String) -> Color {
    switch strategy {
    case "cold_start": return .blue
    case "hybrid": return .orange
    case "personalized": return .green
    default: return .gray
    }
}

func statusColor(_ status: String) -> Color {
    switch status {
    case "accepted": return .green
    case "confirmed": return .green
    case "invited": return .orange
    case "declined": return .red
    case "open": return .blue
    case "completed": return .purple
    case "cancelled": return .gray
    default: return .secondary
    }
}

func userName(_ id: String) -> String {
    seedUsers.first(where: { $0.id == id })?.name ?? id
}
