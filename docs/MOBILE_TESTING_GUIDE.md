# Luna Social — Mobile Testing Guide
## Track 2 Requirements: What Was Built, Where, and How to Test It

**Before starting:** Ensure the backend is running (`npm run dev`) and the app shows **✓ ok** in More → Developer → Health Check.

**Seed users available in the app (top-left picker on Feed/Plans tabs):**

| ID | Name | Profile |
|----|------|---------|
| u1 | Alex Chen | Jazz clubs, omakase, rooftop bars — **fully personalised** |
| u2 | Sarah Kim | Wine bars, rooftop, cocktails — **fully personalised** |
| u3 | Marcus Williams | Sports bars, craft beer — **fully personalised** |
| u4 | Priya Patel | Indian restaurants, yoga — **fully personalised** |
| u5 | Jordan Lee | Brunch, speakeasies — **fully personalised** |
| u6 | Emma Davis | Art galleries, jazz — **fully personalised** |
| u7 | Tom Chen | Burgers, sports — **fully personalised** |
| u8 | Zoe Martinez | Omakase, cocktail bars — **fully personalised** |
| u9–u10 | New users | **Cold start** (no engagement history) |

---

## 1. VENUE SOURCING & CURATION

> *"What makes a place worth showing? How do you determine which venues are high quality, trending, or relevant right now?"*

### What was built
- **Quality score** = 0.35×rating + 0.25×content_richness + 0.25×engagement_factor + 0.15×price_signal
- **Trending score** = engagement velocity in last 48h vs. 7-day baseline
- **Editorial picks** = top quality score venues surfaced for cold-start users
- **Content richness** = vibe descriptions, photos, tags all contribute to score

### How to test on the app

#### Test 1a — Venues list with quality data
1. Tap **Venues** tab
2. Scroll through the list — each card shows **rating (★)**, **price ($$$$)**, **category badge**
3. These are the curated venues in the system — only venues with ratings, content, and engagement scores appear

#### Test 1b — Content richness (vibe descriptions)
1. In **Venues** tab, tap any venue card
2. The detail view shows the venue's **vibe description**, **tags**, and **address** — this is the "alive" content the spec requires
3. Try **Blue Note Jazz Club** — it has a rich description, photos reference, and tags like `["jazz", "live music", "cocktails", "Greenwich Village", "iconic"]`

#### Test 1c — Trending score reflected in feed momentum
1. Go to **Feed** tab (select **Alex Chen** u1)
2. Look at the flame icon beside each venue card:
   - 🔥 **Hot** = trending score high (many recent engagements)
   - 🔥 **Warming** = moderate recent activity
   - ❄️ **Cold** = low recent activity
3. This is the `trendingScore` driving curation

---

## 2. PERSONALIZED RECOMMENDATION

> *"What does this user care about? How do you build and maintain an interest profile from their behavior?"*

### What was built
- **Interest profile** = explicit interest weights × IDF distinctiveness score
- **IDF weighting** = `log(1 + totalUsers / usersWithCategory)` — "jazz clubs" scores higher than "restaurants"
- **Feed formula** = `0.40×venueMatch + 0.30×socialScore + 0.25×temporalScore + 0.05×freshness`
- **Strategy** shown in feed: `personalized`, `hybrid`, or `cold_start`

### How to test on the app

#### Test 2a — Personalisation is working
1. **Feed** tab — select **Alex Chen (u1)** in the top-left picker
2. Note the **PERSONALIZED** green badge and venue rankings — jazz clubs and omakase at the top (Alex's interests)
3. Now switch to **Marcus Williams (u3)**
4. His feed should rank differently — sports bars and craft beer venues rise; jazz clubs fall
5. Switch to **Priya Patel (u4)** — Indian restaurants and yoga venues should appear higher

**What you're verifying:** Different users get different venue rankings from the same pool.

#### Test 2b — IDF distinctiveness (not all interests are equal)
1. Stay on **Feed** tab with **Alex Chen (u1)**
2. The score shown next to each venue (e.g., `0.41`) reflects venue-user match weighted by distinctiveness
3. Alex's jazz club interest scores higher than a generic "restaurants" interest would, because fewer users share it
4. Go to **Interests** tab → **My History** — see Alex's engagement history that built this profile

#### Test 2c — People matching (who to go with)
1. **Feed** tab with any user selected
2. Tap any venue recommendation card
3. The detail view shows **"Suggested People"** — friends/mutuals the system predicts would enjoy this venue
4. These are ranked by interest overlap + social connection strength, not random friends

#### Test 2d — Temporal recommendation (when to go)
1. Tap any Feed venue → detail view
2. **"Best Time"** section shows a suggested day and time (e.g., "Saturday Evening")
3. This combines: friend availability patterns + venue busyness sweet spot (peaks at ~60% occupancy) + user's own preferred hours derived from past engagement

---

## 3. COLD START HANDLING

> *"A new user has no engagement history. How does your recommendation engine handle someone it knows nothing about yet?"*

### What was built
- 0 engagements → **cold_start**: editorial picks + trending venues
- 1–4 engagements → **hybrid**: 70% trending + 30% personalised
- 5+ engagements → **personalized**: full IDF-weighted profile

### How to test on the app

#### Test 3a — Cold start feed
1. **Feed** tab — switch user to **u9** or **u10** (new users, no history)
2. The badge changes from **PERSONALIZED** to **COLD START**
3. The venues shown are editorial picks and trending venues — not personalised
4. Compare with Alex Chen's feed — completely different ordering and badge

#### Test 3b — Simulate becoming a known user
1. Go to **More → Developer → Fire Event**
2. Set user to **u9**, Event Type = `interest_expressed`, Venue ID = `v1`
3. Tap **Fire Event** → ✓ Accepted
4. Go back to **Feed** tab, switch to **u9**, pull to refresh
5. Badge may shift toward **HYBRID** once enough events are fired (fire 5+ events to reach **PERSONALIZED**)

---

## 4. SOCIAL GRAPH PROPAGATION

> *"When a user sees a venue, they have two choices — express interest or invite people directly."*

### What was built
- **Depth-1 propagation**: signal strength = `levelWeight × edgeStrength`, 7-day TTL
- **Depth-2 propagation**: signal strength = `levelWeight × 0.3` (mutual dampening)
- **Level weights**: viewed=0.1, interested=0.4, planning=0.6, confirmed=0.9, attended=1.0
- **Initiator ordering**: propagation sent to high-initiatorScore friends first
- **Social proof**: `friendsInterested` and `friendsConfirmed` arrays per venue

### How to test on the app

#### Test 4a — Express interest and see propagation
1. Go to **Interests** tab → **Express** sub-tab
2. Select user **Sarah Kim (u2)**, pick a venue (e.g., **Blue Note Jazz Club**), set level to **interested**
3. Tap **Express Interest** → see confirmation with level saved
4. Now switch user to **Alex Chen (u1)** (who is friends with Sarah)
5. Go to **Feed** tab, pull to refresh
6. Blue Note Jazz Club's **social score** increases — Sarah's signal has propagated to Alex's feed

#### Test 4b — See social proof on a venue
1. Go to **More → Developer → Quick Tests**
2. Tap **Social Proof v1+u1** → see raw JSON in **Last Response**
3. You'll see `friendsInterested` listing friends who expressed interest, `momentumTrend` showing the flywheel status, and `interestedCount`

#### Test 4c — Flywheel momentum building
1. **Interests → Express**: express interest from multiple users (u2, u3, u4) in the **same venue** (e.g., `v1`)
2. After each one, check the venue's social proof via Developer → Quick Tests → **Social Proof v1+u1**
3. Watch `momentumTrend` progress: `cold` → `warming` → `hot` → `peaking`
4. This is the flywheel — each engagement makes the venue more visible to the next user

#### Test 4d — Propagation ordering (initiators first)
The system always propagates to high-initiatorScore friends first. Alex Chen (u1) has initiatorScore 0.85 on his edge — he initiates plans more than average, so venues are shown to him before passive users in the same friend group.

---

## 5. INTEREST HISTORY (View Engagement Records)

> *"They now appear as 'interested' to other users who see this venue."*

### How to test on the app

#### Test 5a — My History tab
1. **Interests** tab → **My History** sub-tab
2. Switch users using the refresh button — each user's engagement history loads
3. Alex Chen (u1) shows: `v1 interested`, `v4 planning`, `v17 interested`, `v3 viewed`
4. These are the signals feeding his interest profile

#### Test 5b — By Venue tab
1. **Interests** tab → **By Venue** sub-tab
2. Enter a venue ID (e.g., `v1`) and tap **Load**
3. See all users who have engaged with that venue and at what level
4. This shows the raw social proof data — who is "interested" or "planning" at that venue

---

## 6. PLANS & SOCIAL COORDINATION

> *"Jump straight to inviting people. Invitations create confirmed plans — confirmed plans are the strongest social proof."*

### What was built
- Plans have `open → confirmed → completed` status lifecycle
- Participants have `invited → accepted/declined/maybe` statuses
- Confirmed plans generate the highest-weight social proof signal (confirmed=0.9)

### How to test on the app

#### Test 6a — Create a plan
1. **Plans** tab — tap **+** (top right)
2. Select **Creator** (e.g., Alex Chen u1)
3. Select a **Venue** from the dropdown
4. Set a **date/time** (must be in the future)
5. **Invite Friends** — tap checkboxes next to Sarah Kim and Marcus Williams
6. Tap **Create** → plan appears in **My Plans** tab

#### Test 6b — Respond to an invitation
1. Switch user to **Sarah Kim (u2)** using the top-left picker
2. Tap **Invitations** segment (next to My Plans)
3. The plan you just created appears here — tap it
4. Tap **Accept**, **Maybe**, or **Decline**
5. Switch back to u1's **My Plans** → tap the plan → **Participants** section shows Sarah's updated status

#### Test 6c — Confirmed plan = strongest social proof
1. After accepting, go to **More → Developer → Quick Tests → Social Proof v1+u1**
2. The venue from the plan now shows in `friendsConfirmed` — the highest-weight signal
3. This venue will appear boosted in Alex's feed because a friend confirmed attending

---

## 7. AI BOOKING AGENT (Bonus)

> *"Implement agents to generate automated reservations, bookings, or purchases once users have agreed to go."*

### What was built
- Claude Haiku (`claude-haiku-4-5`) reads plan details and makes a booking decision
- Returns a structured `confirmationCode` or `error` reason
- Falls back to mock response if no API key is set

### How to test on the app

#### Test 7a — Book a plan with AI Agent
1. **Plans** tab → tap any existing plan to open its detail view
2. Scroll to the **AI Booking Agent** section at the bottom
3. Tap **Book with AI Agent**
4. Watch the spinner — the agent is reading the venue, plan details, and party size
5. Result appears: either a **✓ Confirmed: [code]** with venue name, time, and party size, or an **Unavailable** message with a reason
6. The confirmation code is stored in the plan's `bookingReference` field

---

## 8. EVENT PIPELINE (Async / Event-Driven)

> *"Engagement events should kick off async pipelines, not synchronous request handlers."*

### What was built
- `POST /api/events` persists event to DB, returns HTTP 200 immediately
- `setImmediate()` fires propagation after response — HTTP never blocks on graph traversal
- New event types: `venue_view`, `venue_skip`, `venue_share`, `interest_expressed`, `plan_created`, `booking_completed`

### How to test on the app

#### Test 8a — Fire events directly
1. **More → Developer → Fire Event**
2. Select **Event Type** from the picker (e.g., `venue_view`)
3. Enter **Venue ID** (e.g., `v1`)
4. Tap **Fire Event** → response should be **✓ Accepted** instantly
5. The response is instant because the HTTP handler returns before propagation runs

#### Test 8b — Verify event was recorded
1. After firing an event for u1 on v1
2. Go to **More → Developer → Quick Tests → Engagements u1**
3. See the event appear in **Last Response** — it was persisted synchronously before the response
4. The propagation to friends happens asynchronously via the event bus

---

## FULL END-TO-END WALKTHROUGH

Follow this sequence to demonstrate the entire Track 2 pipeline in one continuous demo:

```
Step 1 → Feed tab, user u9 (cold start) — see COLD START badge, editorial venues
Step 2 → Switch to u1 (Alex Chen) — see PERSONALIZED badge, jazz/omakase ranked high
Step 3 → Interests tab → Express → u2 (Sarah Kim) → Blue Note Jazz Club → "interested"
Step 4 → Switch back to u1, Feed tab, pull to refresh — Blue Note score increases (Sarah's signal)
Step 5 → Tap Blue Note → see Suggested People (friends who'd also enjoy it)
Step 6 → Plans tab → "+" → create plan at Blue Note, invite Sarah and Marcus
Step 7 → Switch to u2 → Invitations → Accept the plan
Step 8 → Switch back to u1 → tap the plan → AI Booking Agent → Book with AI Agent
Step 9 → See confirmation code returned by Claude Haiku
Step 10 → Developer → Quick Tests → Social Proof v1+u1 — see friendsConfirmed, momentumTrend "hot"
```

This single flow exercises: cold-start → personalisation → interest propagation → social proof → plan creation → invitation flow → AI booking → flywheel momentum.

---

## QUICK REFERENCE: Developer Tab Tests

The **More → Developer → Quick Tests** section lets you inspect raw API responses:

| Button | What It Tests |
|--------|--------------|
| Feed (u1) | Personalised feed with scores, social proof, suggested people |
| Venues List | Curated venue pool with quality/trending scores |
| User u1 | User profile data |
| Friends u1 | Social graph edges with strength + initiatorScore |
| Engagements u1 | Interest history feeding the profile |
| Social Proof v1+u1 | Live social proof for Blue Note Jazz Club from Alex's perspective |
