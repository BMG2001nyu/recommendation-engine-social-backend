import SwiftUI

struct PlansView: View {
    @ObservedObject var api: APIService
    @Binding var selectedUser: String

    @State private var myPlans: [LunaPlan] = []
    @State private var invitations: [LunaPlan] = []
    @State private var isLoading = false
    @State private var error: String?
    @State private var showCreateSheet = false
    @State private var selectedPlan: LunaPlan?
    @State private var tab = 0

    var body: some View {
        VStack(spacing: 0) {
            // Toolbar
            HStack(spacing: 12) {
                UserPickerRow(selectedUser: $selectedUser, label: "User:")
                Divider().frame(height: 20)
                Picker("", selection: $tab) {
                    Text("My Plans").tag(0)
                    Text("Invitations").tag(1)
                }
                .pickerStyle(.segmented)
                .frame(maxWidth: 200)
                Spacer()
                Button {
                    Task { await loadAll() }
                } label: {
                    Label("Refresh", systemImage: "arrow.clockwise")
                }
                .buttonStyle(.bordered)
                .disabled(isLoading)

                Button {
                    showCreateSheet = true
                } label: {
                    Label("Create Plan", systemImage: "plus")
                }
                .buttonStyle(.borderedProminent)
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
            } else {
                HSplitView {
                    // List
                    VStack(spacing: 0) {
                        if tab == 0 {
                            if myPlans.isEmpty {
                                ContentUnavailableView("No Plans", systemImage: "calendar.badge.plus",
                                    description: Text("Create a plan to get started"))
                            } else {
                                List(myPlans, selection: $selectedPlan) { plan in
                                    PlanRow(plan: plan, showRespond: false)
                                        .tag(plan)
                                        .contentShape(Rectangle())
                                        .onTapGesture { selectedPlan = plan }
                                }
                                .listStyle(.plain)
                            }
                        } else {
                            if invitations.isEmpty {
                                ContentUnavailableView("No Invitations", systemImage: "envelope",
                                    description: Text("No pending invitations"))
                            } else {
                                List(invitations, selection: $selectedPlan) { plan in
                                    PlanRow(plan: plan, showRespond: true)
                                        .tag(plan)
                                        .contentShape(Rectangle())
                                        .onTapGesture { selectedPlan = plan }
                                }
                                .listStyle(.plain)
                            }
                        }
                    }
                    .frame(minWidth: 300, maxWidth: 380)

                    // Detail
                    if let plan = selectedPlan {
                        PlanDetailView(api: api, plan: plan, selectedUser: $selectedUser) {
                            Task { await loadAll() }
                        }
                        .frame(minWidth: 380)
                    } else {
                        ContentUnavailableView("Select a Plan", systemImage: "calendar",
                            description: Text("Tap a plan to see details"))
                        .frame(minWidth: 380)
                    }
                }
            }
        }
        .sheet(isPresented: $showCreateSheet) {
            CreatePlanSheet(api: api, selectedUser: $selectedUser) { newPlan in
                myPlans.insert(newPlan, at: 0)
                selectedPlan = newPlan
            }
        }
        .task { await loadAll() }
        .onChange(of: selectedUser) { _, _ in Task { await loadAll() } }
    }

    func loadAll() async {
        isLoading = true
        error = nil
        do {
            async let p = api.getUserPlans(userId: selectedUser)
            async let i = api.getUserInvitations(userId: selectedUser)
            let (plans, invs) = try await (p, i)
            myPlans = plans.plans
            invitations = invs.invitations
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }
}

struct PlanRow: View {
    let plan: LunaPlan
    let showRespond: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(plan.venue?.name ?? plan.venueId)
                    .font(.subheadline).fontWeight(.medium)
                Spacer()
                BadgeView(text: plan.status, color: statusColor(plan.status))
            }
            HStack(spacing: 6) {
                Image(systemName: "calendar").font(.caption2).foregroundColor(.secondary)
                Text(formattedDate(plan.scheduledTime)).font(.caption).foregroundColor(.secondary)
                if let participants = plan.participants {
                    Spacer()
                    Image(systemName: "person.2").font(.caption2).foregroundColor(.secondary)
                    Text("\(participants.count)").font(.caption2).foregroundColor(.secondary)
                }
            }
            Text("By \(userName(plan.createdBy))").font(.caption2).foregroundColor(.secondary)
        }
        .padding(.vertical, 4)
    }
}

struct PlanDetailView: View {
    @ObservedObject var api: APIService
    let plan: LunaPlan
    @Binding var selectedUser: String
    let onRefresh: () -> Void

    @State private var detail: LunaPlan?
    @State private var isLoading = false
    @State private var error: String?
    @State private var bookingResult: BookingResult?
    @State private var isBooking = false
    @State private var bookingError: String?
    @State private var respondResult: String?

    var displayPlan: LunaPlan { detail ?? plan }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                // Header
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(displayPlan.venue?.name ?? displayPlan.venueId)
                            .font(.title2).fontWeight(.bold)
                        Text("Created by \(userName(displayPlan.createdBy))")
                            .font(.caption).foregroundColor(.secondary)
                    }
                    Spacer()
                    BadgeView(text: displayPlan.status, color: statusColor(displayPlan.status))
                }

                // Info
                Grid(alignment: .leading, horizontalSpacing: 12, verticalSpacing: 6) {
                    GridRow {
                        Label("Scheduled", systemImage: "clock").font(.caption).foregroundColor(.secondary)
                        Text(formattedDate(displayPlan.scheduledTime)).font(.caption)
                    }
                    GridRow {
                        Label("Plan ID", systemImage: "number").font(.caption).foregroundColor(.secondary)
                        Text(displayPlan.id).font(.caption2).foregroundColor(.secondary)
                    }
                    if let ref = displayPlan.bookingReference {
                        GridRow {
                            Label("Booking Ref", systemImage: "ticket").font(.caption).foregroundColor(.secondary)
                            Text(ref).font(.caption).fontWeight(.medium).foregroundColor(.green)
                        }
                    }
                }

                Divider()

                // Participants
                GroupBox(label: Label("Participants (\(displayPlan.participants?.count ?? 0))", systemImage: "person.3")) {
                    if let participants = displayPlan.participants {
                        ForEach(participants) { p in
                            HStack {
                                Text(p.user?.name ?? userName(p.userId))
                                    .font(.subheadline)
                                Spacer()
                                BadgeView(text: p.status, color: statusColor(p.status))
                            }
                            .padding(.vertical, 2)
                            Divider()
                        }
                    }
                }

                // Respond (if invited)
                if let participants = displayPlan.participants,
                   let myParticipation = participants.first(where: { $0.userId == selectedUser }),
                   myParticipation.status == "invited" {
                    GroupBox(label: Label("Your Response", systemImage: "hand.raised")) {
                        HStack(spacing: 8) {
                            Button("Accept") {
                                Task { await respond("accepted") }
                            }
                            .buttonStyle(.borderedProminent)
                            .tint(.green)

                            Button("Maybe") {
                                Task { await respond("maybe") }
                            }
                            .buttonStyle(.bordered)

                            Button("Decline") {
                                Task { await respond("declined") }
                            }
                            .buttonStyle(.bordered)
                            .tint(.red)

                            if let msg = respondResult {
                                Text(msg).font(.caption).foregroundColor(.green)
                            }
                        }
                    }
                }

                // Book
                if displayPlan.status == "open" || displayPlan.status == "confirmed" {
                    GroupBox(label: Label("AI Booking Agent", systemImage: "sparkles")) {
                        VStack(alignment: .leading, spacing: 8) {
                            if let result = bookingResult {
                                if let code = result.confirmationCode {
                                    HStack {
                                        Image(systemName: "checkmark.seal.fill").foregroundColor(.green)
                                        Text("Confirmation: \(code)").fontWeight(.semibold)
                                    }
                                    if let venue = result.venueName { Text("Venue: \(venue)").font(.caption) }
                                    if let time = result.scheduledTime { Text("Time: \(formattedDate(time))").font(.caption) }
                                    if let size = result.partySize { Text("Party: \(size)").font(.caption) }
                                }
                                if let err = result.error {
                                    Text("Agent unavailable: \(err)").font(.caption).foregroundColor(.orange)
                                }
                            } else {
                                Button {
                                    Task { await bookPlan() }
                                } label: {
                                    if isBooking {
                                        Label("Booking…", systemImage: "sparkles")
                                    } else {
                                        Label("Book with AI Agent", systemImage: "sparkles")
                                    }
                                }
                                .buttonStyle(.borderedProminent)
                                .disabled(isBooking)

                                if let err = bookingError {
                                    Text(err).font(.caption).foregroundColor(.red)
                                }
                            }
                        }
                        .padding(.vertical, 4)
                    }
                }
            }
            .padding()
        }
        .task { await loadDetail() }
    }

    func loadDetail() async {
        isLoading = true
        error = nil
        do {
            detail = try await api.getPlan(id: plan.id)
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }

    func respond(_ response: String) async {
        do {
            let result = try await api.respondToInvite(planId: plan.id, userId: selectedUser, response: response)
            respondResult = "Responded: \(result.status)"
            await loadDetail()
            onRefresh()
        } catch {
            respondResult = "Error: \(error.localizedDescription)"
        }
    }

    func bookPlan() async {
        isBooking = true
        bookingError = nil
        do {
            bookingResult = try await api.bookPlan(planId: plan.id)
            if bookingResult?.error != nil {
                bookingError = bookingResult?.error
                bookingResult = nil
            } else {
                await loadDetail()
                onRefresh()
            }
        } catch {
            bookingError = error.localizedDescription
        }
        isBooking = false
    }
}

// MARK: - Create Plan Sheet
struct CreatePlanSheet: View {
    @ObservedObject var api: APIService
    @Binding var selectedUser: String
    let onCreated: (LunaPlan) -> Void

    @Environment(\.dismiss) private var dismiss

    @State private var venues: [LunaVenue] = []
    @State private var selectedVenueId = ""
    @State private var scheduledDate = Date().addingTimeInterval(7 * 24 * 3600)
    @State private var inviteeIds: Set<String> = []
    @State private var isCreating = false
    @State private var error: String?

    var availableInvitees: [(id: String, name: String)] {
        seedUsers.filter { $0.id != selectedUser }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            Text("Create Plan")
                .font(.title2).fontWeight(.bold)

            UserPickerRow(selectedUser: $selectedUser, label: "Created by:")

            // Venue picker
            VStack(alignment: .leading, spacing: 4) {
                Text("Venue").font(.caption).foregroundColor(.secondary)
                if venues.isEmpty {
                    Text("Loading venues…").font(.caption).foregroundColor(.secondary)
                } else {
                    Picker("Venue", selection: $selectedVenueId) {
                        Text("— Select —").tag("")
                        ForEach(venues) { v in
                            Text("\(v.name) (\(v.category))").tag(v.id)
                        }
                    }
                    .pickerStyle(.menu)
                }
            }

            // Date picker
            VStack(alignment: .leading, spacing: 4) {
                Text("Scheduled Time").font(.caption).foregroundColor(.secondary)
                DatePicker("", selection: $scheduledDate, in: Date()..., displayedComponents: [.date, .hourAndMinute])
                    .labelsHidden()
            }

            // Invitees
            VStack(alignment: .leading, spacing: 4) {
                Text("Invite Friends (optional)").font(.caption).foregroundColor(.secondary)
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 140))], spacing: 6) {
                    ForEach(availableInvitees, id: \.id) { u in
                        Toggle(isOn: Binding(
                            get: { inviteeIds.contains(u.id) },
                            set: { if $0 { inviteeIds.insert(u.id) } else { inviteeIds.remove(u.id) } }
                        )) {
                            Text("\(u.id) — \(u.name)").font(.caption)
                        }
                        .toggleStyle(.checkbox)
                    }
                }
            }

            if let error {
                ErrorBanner(message: error)
            }

            HStack {
                Spacer()
                Button("Cancel") { dismiss() }
                    .buttonStyle(.bordered)
                Button("Create") {
                    Task { await createPlan() }
                }
                .buttonStyle(.borderedProminent)
                .disabled(selectedVenueId.isEmpty || isCreating)
            }
        }
        .padding(24)
        .frame(width: 480)
        .task { await loadVenues() }
    }

    func loadVenues() async {
        do {
            let result = try await api.getVenues(limit: 20)
            venues = result.venues
            if let first = result.venues.first { selectedVenueId = first.id }
        } catch {}
    }

    func createPlan() async {
        isCreating = true
        error = nil
        let iso = ISO8601DateFormatter()
        let timeStr = iso.string(from: scheduledDate)
        do {
            let plan = try await api.createPlan(
                venueId: selectedVenueId,
                createdBy: selectedUser,
                scheduledTime: timeStr,
                inviteeIds: Array(inviteeIds)
            )
            onCreated(plan)
            dismiss()
        } catch {
            self.error = error.localizedDescription
        }
        isCreating = false
    }
}
