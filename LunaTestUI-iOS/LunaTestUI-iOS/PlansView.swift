import SwiftUI

struct PlansView: View {
    @ObservedObject var api: APIService
    @Binding var selectedUser: String

    @State private var myPlans: [LunaPlan] = []
    @State private var invitations: [LunaPlan] = []
    @State private var isLoading = false
    @State private var error: String?
    @State private var tab = 0
    @State private var showCreateSheet = false

    var body: some View {
        NavigationStack {
            ZStack {
                Color.lunaBackground.ignoresSafeArea()

                VStack(spacing: 0) {
                    if isLoading && myPlans.isEmpty && invitations.isEmpty {
                        Spacer()
                        ProgressView().tint(.lunaPurple).scaleEffect(1.3)
                        Text("Loading…").font(.caption).foregroundColor(.secondary).padding(.top, 8)
                        Spacer()
                    } else {
                        let items = tab == 0 ? myPlans : invitations
                        if items.isEmpty {
                            emptyState(forTab: tab)
                        } else {
                            ScrollView {
                                LazyVStack(spacing: 10) {
                                    ForEach(items) { plan in
                                        NavigationLink {
                                            PlanDetailView(api: api, plan: plan, selectedUser: $selectedUser, onRefresh: { Task { await loadAll() } })
                                        } label: {
                                            PlanCard(plan: plan)
                                        }
                                        .buttonStyle(.plain)
                                        .padding(.horizontal)
                                    }
                                }
                                .padding(.top, 8)
                                .padding(.bottom, 100)
                            }
                            .refreshable { await loadAll() }
                        }
                    }
                }
            }
            .navigationTitle("Plans")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(.hidden, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Picker("User", selection: $selectedUser) {
                        ForEach(seedUsers, id: \.id) { u in Text(u.name).tag(u.id) }
                    }
                    .pickerStyle(.menu)
                    .tint(.lunaPurple)
                }
                ToolbarItem(placement: .principal) {
                    Picker("", selection: $tab) {
                        Text("My Plans").tag(0)
                        Text("Invitations").tag(1)
                    }
                    .pickerStyle(.segmented)
                    .frame(width: 200)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button { showCreateSheet = true } label: {
                        Image(systemName: "plus")
                            .foregroundColor(.lunaPurple)
                    }
                }
            }
            .overlay(alignment: .top) {
                if let error { ErrorBanner(message: error).padding(.top, 4) }
            }
        }
        .sheet(isPresented: $showCreateSheet) {
            CreatePlanSheet(api: api, selectedUser: $selectedUser) { newPlan in
                myPlans.insert(newPlan, at: 0)
            }
        }
        .task { await loadAll() }
        .onChange(of: selectedUser) { _, _ in Task { await loadAll() } }
    }

    @ViewBuilder
    func emptyState(forTab tab: Int) -> some View {
        VStack(spacing: 20) {
            ZStack {
                Circle()
                    .fill(Color.lunaCard)
                    .frame(width: 88, height: 88)
                Image(systemName: tab == 0 ? "calendar.badge.plus" : "envelope")
                    .font(.system(size: 36))
                    .foregroundStyle(LinearGradient(colors: [.lunaPurple, .lunaGold], startPoint: .topLeading, endPoint: .bottomTrailing))
            }
            VStack(spacing: 6) {
                Text(tab == 0 ? "No Plans Yet" : "No Invitations")
                    .font(.title3).fontWeight(.semibold)
                    .foregroundColor(.white)
                Text(tab == 0 ? "Create a plan to go out with friends" : "You'll see invitations here")
                    .font(.subheadline).foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
            }
            if tab == 0 {
                Button {
                    showCreateSheet = true
                } label: {
                    Label("Create a Plan", systemImage: "plus")
                        .fontWeight(.semibold)
                        .foregroundColor(.white)
                        .padding(.horizontal, 24)
                        .padding(.vertical, 12)
                        .background(
                            LinearGradient(colors: [.lunaPurple, .lunaDeepPurple], startPoint: .leading, endPoint: .trailing)
                        )
                        .clipShape(Capsule())
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding()
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

struct PlanCard: View {
    let plan: LunaPlan

    var body: some View {
        HStack(spacing: 14) {
            ZStack {
                RoundedRectangle(cornerRadius: 10)
                    .fill(LinearGradient(colors: [statusColor(plan.status).opacity(0.3), Color.lunaBackground], startPoint: .topLeading, endPoint: .bottomTrailing))
                    .frame(width: 46, height: 46)
                Image(systemName: "calendar")
                    .font(.system(size: 20))
                    .foregroundColor(statusColor(plan.status))
            }

            VStack(alignment: .leading, spacing: 5) {
                HStack {
                    Text(plan.venue?.name ?? plan.venueId)
                        .font(.subheadline).fontWeight(.semibold)
                        .foregroundColor(.white)
                    Spacer()
                    BadgeView(text: plan.status, color: statusColor(plan.status))
                }
                HStack(spacing: 6) {
                    Image(systemName: "calendar").font(.caption2).foregroundColor(.secondary)
                    Text(formattedDate(plan.scheduledTime)).font(.caption2).foregroundColor(.secondary)
                }
                HStack(spacing: 6) {
                    Image(systemName: "person").font(.caption2).foregroundColor(.secondary)
                    Text("By \(userName(plan.createdBy))").font(.caption2).foregroundColor(.secondary)
                    if let count = plan.participants?.count {
                        Text("· \(count) people").font(.caption2).foregroundColor(.secondary)
                    }
                }
            }

            Image(systemName: "chevron.right").font(.caption2).foregroundColor(.secondary)
        }
        .padding(12)
        .background(Color.lunaCard)
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).strokeBorder(statusColor(plan.status).opacity(0.2), lineWidth: 0.5))
    }
}

struct PlanDetailView: View {
    @ObservedObject var api: APIService
    let plan: LunaPlan
    @Binding var selectedUser: String
    let onRefresh: () -> Void

    @State private var detail: LunaPlan?
    @State private var bookingResult: BookingResult?
    @State private var isBooking = false
    @State private var bookingError: String?
    @State private var respondMsg: String?

    var displayPlan: LunaPlan { detail ?? plan }

    var body: some View {
        ZStack {
            Color.lunaBackground.ignoresSafeArea()
            List {
                Section("Plan Info") {
                    LabeledContent("Venue", value: displayPlan.venue?.name ?? displayPlan.venueId)
                    LabeledContent("Created By", value: userName(displayPlan.createdBy))
                    LabeledContent("Scheduled", value: formattedDate(displayPlan.scheduledTime))
                    LabeledContent("Status", value: displayPlan.status)
                    LabeledContent("Plan ID", value: displayPlan.id)
                    if let ref = displayPlan.bookingReference {
                        LabeledContent("Booking Ref", value: ref)
                    }
                }

                if let participants = displayPlan.participants, !participants.isEmpty {
                    Section("Participants (\(participants.count))") {
                        ForEach(participants) { p in
                            HStack {
                                Text(p.user?.name ?? userName(p.userId))
                                Spacer()
                                BadgeView(text: p.status, color: statusColor(p.status))
                            }
                        }
                    }
                }

                if let participants = displayPlan.participants,
                   let mine = participants.first(where: { $0.userId == selectedUser }),
                   mine.status == "invited" {
                    Section("Your Response") {
                        HStack(spacing: 12) {
                            Button("Accept") { Task { await respond("accepted") } }
                                .buttonStyle(.borderedProminent).tint(.green)
                            Button("Maybe") { Task { await respond("maybe") } }
                                .buttonStyle(.bordered)
                            Button("Decline") { Task { await respond("declined") } }
                                .buttonStyle(.bordered).tint(.red)
                        }
                        if let msg = respondMsg {
                            Text(msg).font(.caption).foregroundColor(.green)
                        }
                    }
                }

                Section("AI Booking Agent") {
                    if let result = bookingResult {
                        if let code = result.confirmationCode {
                            Label("Confirmed: \(code)", systemImage: "checkmark.seal.fill")
                                .foregroundColor(.green)
                            if let v = result.venueName { LabeledContent("Venue", value: v) }
                            if let t = result.scheduledTime { LabeledContent("Time", value: formattedDate(t)) }
                            if let s = result.partySize { LabeledContent("Party", value: "\(s)") }
                        }
                        if let err = result.error {
                            Text("Unavailable: \(err)").font(.caption).foregroundColor(.orange)
                        }
                    } else {
                        Button {
                            Task { await book() }
                        } label: {
                            if isBooking {
                                ProgressView("Booking…").controlSize(.small)
                            } else {
                                Label("Book with AI Agent", systemImage: "sparkles")
                            }
                        }
                        .disabled(isBooking)
                        if let err = bookingError {
                            Text(err).font(.caption).foregroundColor(.red)
                        }
                    }
                }
            }
            .scrollContentBackground(.hidden)
        }
        .navigationTitle(displayPlan.venue?.name ?? "Plan")
        .navigationBarTitleDisplayMode(.inline)
        .task { await loadDetail() }
    }

    func loadDetail() async {
        do { detail = try await api.getPlan(id: plan.id) } catch {}
    }

    func respond(_ response: String) async {
        do {
            let result = try await api.respondToInvite(planId: plan.id, userId: selectedUser, response: response)
            respondMsg = "✓ Responded: \(result.status)"
            await loadDetail()
            onRefresh()
        } catch {
            respondMsg = "✗ \(error.localizedDescription)"
        }
    }

    func book() async {
        isBooking = true
        bookingError = nil
        do {
            bookingResult = try await api.bookPlan(planId: plan.id)
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
        NavigationStack {
            Form {
                Section("Creator") {
                    Picker("User", selection: $selectedUser) {
                        ForEach(seedUsers, id: \.id) { u in Text(u.name).tag(u.id) }
                    }
                }

                Section("Venue") {
                    if venues.isEmpty {
                        Text("Loading venues…").foregroundColor(.secondary)
                    } else {
                        Picker("Venue", selection: $selectedVenueId) {
                            Text("Select…").tag("")
                            ForEach(venues) { v in
                                Text("\(v.name) (\(v.category))").tag(v.id)
                            }
                        }
                    }
                }

                Section("When") {
                    DatePicker("Scheduled Time", selection: $scheduledDate, in: Date()..., displayedComponents: [.date, .hourAndMinute])
                }

                Section("Invite Friends") {
                    ForEach(availableInvitees, id: \.id) { u in
                        HStack {
                            Text(u.name)
                            Spacer()
                            Image(systemName: inviteeIds.contains(u.id) ? "checkmark.circle.fill" : "circle")
                                .foregroundColor(inviteeIds.contains(u.id) ? .lunaPurple : .secondary)
                        }
                        .contentShape(Rectangle())
                        .onTapGesture {
                            if inviteeIds.contains(u.id) { inviteeIds.remove(u.id) }
                            else { inviteeIds.insert(u.id) }
                        }
                    }
                }

                if let error {
                    Section { Text(error).foregroundColor(.red).font(.caption) }
                }
            }
            .navigationTitle("Create Plan")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Create") {
                        Task { await createPlan() }
                    }
                    .disabled(selectedVenueId.isEmpty || isCreating)
                    .fontWeight(.semibold)
                    .tint(.lunaPurple)
                }
            }
            .task { await loadVenues() }
        }
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
        do {
            let plan = try await api.createPlan(
                venueId: selectedVenueId,
                createdBy: selectedUser,
                scheduledTime: iso.string(from: scheduledDate),
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
