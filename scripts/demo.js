// Luna Social — Playwright Demo Script
// Records a ~7-minute walkthrough of all Track 2 backend features

const { chromium } = require('playwright');
const path = require('path');

const BASE = 'http://localhost:3000';
const OUT_DIR = path.join(__dirname, '..', 'demo-recording');

// ── helpers ──────────────────────────────────────────────────────────────────

async function pause(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function showSlide(page, title, subtitle = '') {
  await page.evaluate(({ title, subtitle }) => {
    document.body.innerHTML = `
      <div style="
        font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif;
        background: #0a0a0f;
        color: #fff;
        height: 100vh;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
        padding: 40px;
      ">
        <div style="
          background: linear-gradient(135deg, #7c3aed, #c084fc);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          font-size: 52px;
          font-weight: 800;
          letter-spacing: -1px;
          margin-bottom: 20px;
          line-height: 1.1;
        ">${title}</div>
        <div style="
          color: #94a3b8;
          font-size: 22px;
          max-width: 700px;
          line-height: 1.6;
        ">${subtitle}</div>
        <div style="
          margin-top: 40px;
          width: 60px;
          height: 3px;
          background: linear-gradient(90deg, #7c3aed, #c084fc);
          border-radius: 2px;
        "></div>
      </div>`;
  }, { title, subtitle });
}

async function showApiResponse(page, { title, method, endpoint, data, highlight = '' }) {
  const json = JSON.stringify(data, null, 2);
  const escaped = json
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  await page.evaluate(({ title, method, endpoint, escaped, highlight }) => {
    const methodColor = method === 'GET' ? '#60a5fa' : '#f97316';
    const highlightLines = highlight
      ? escaped.split('\n').map(line =>
          line.includes(highlight)
            ? `<span style="background:#7c3aed33;color:#c084fc;border-left:3px solid #7c3aed;padding-left:4px;display:block">${line}</span>`
            : line
        ).join('\n')
      : escaped;

    document.body.innerHTML = `
      <div style="
        font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif;
        background: #0a0a0f;
        color: #e2e8f0;
        height: 100vh;
        display: flex;
        flex-direction: column;
        padding: 32px;
        box-sizing: border-box;
        overflow: hidden;
      ">
        <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px;flex-shrink:0;">
          <div style="
            background: linear-gradient(135deg, #7c3aed, #c084fc);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            font-size: 26px;
            font-weight: 800;
          ">${title}</div>
          <div style="
            background: #1e1b4b;
            border: 1px solid #4c1d95;
            border-radius: 8px;
            padding: 6px 14px;
            font-family: 'SF Mono', monospace;
            font-size: 13px;
            color: ${methodColor};
          "><span style="font-weight:700">${method}</span> <span style="color:#94a3b8">${endpoint}</span></div>
        </div>
        <div style="
          flex: 1;
          background: #0f0f1a;
          border: 1px solid #1e1b4b;
          border-radius: 12px;
          padding: 20px;
          overflow: hidden;
          font-family: 'SF Mono', 'Fira Code', monospace;
          font-size: 12.5px;
          line-height: 1.7;
          color: #a5b4fc;
          white-space: pre;
        ">${highlightLines}</div>
      </div>`;
  }, { title, method, endpoint, escaped, highlight });
}

async function fetchJson(url, opts = {}) {
  const { default: fetch } = await import('node-fetch');
  const resp = await fetch(url, opts);
  return resp.json();
}

// ── main ─────────────────────────────────────────────────────────────────────

(async () => {
  const fs = require('fs');
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    recordVideo: { dir: OUT_DIR, size: { width: 1280, height: 800 } },
  });
  const page = await ctx.newPage();

  // ── 1. Title ──────────────────────────────────────────────────────────────
  await showSlide(page,
    'Luna Social',
    'Track 2: Backend Engineering<br>Recommendation Engine · Social Graph Intelligence · AI Agents'
  );
  await pause(4000);

  // ── 2. Architecture overview ──────────────────────────────────────────────
  await showSlide(page,
    'Three-Layer Pipeline',
    '<b style="color:#c084fc">Layer 1</b> — Venue Curation: quality + trending scores<br>' +
    '<b style="color:#c084fc">Layer 2</b> — Personalisation: IDF-weighted interest profiles<br>' +
    '<b style="color:#c084fc">Layer 3</b> — Social Propagation: graph signals → flywheel momentum'
  );
  await pause(5000);

  // ── 3. Health check ───────────────────────────────────────────────────────
  await showSlide(page, 'Backend Health', 'Confirming the server is live');
  await pause(2000);
  const health = await fetchJson(`${BASE}/health`);
  await showApiResponse(page, {
    title: 'Health Check',
    method: 'GET', endpoint: '/health',
    data: health, highlight: 'ok',
  });
  await pause(4000);

  // ── 4. Venue curation ─────────────────────────────────────────────────────
  await showSlide(page,
    'Venue Sourcing & Curation',
    'Quality score = 0.35×rating + 0.25×content_richness + 0.25×engagement_factor + 0.15×price_signal<br>' +
    'Trending = engagement velocity last 48h vs 7-day baseline'
  );
  await pause(5000);

  const venues = await fetchJson(`${BASE}/api/venues?limit=6`);
  await showApiResponse(page, {
    title: 'Curated Venue Pool',
    method: 'GET', endpoint: '/api/venues?limit=6',
    data: venues, highlight: 'qualityScore',
  });
  await pause(6000);

  // Venue detail with richness
  const venueDetail = await fetchJson(`${BASE}/api/venues/v1`);
  await showApiResponse(page, {
    title: 'Content Richness — Blue Note Jazz Club',
    method: 'GET', endpoint: '/api/venues/v1',
    data: venueDetail, highlight: 'vibeDescription',
  });
  await pause(6000);

  // ── 5. Cold start ─────────────────────────────────────────────────────────
  await showSlide(page,
    'Cold Start Handling',
    '0 engagements → <b style="color:#c084fc">cold_start</b>: editorial picks + trending<br>' +
    '1–4 engagements → <b style="color:#c084fc">hybrid</b>: 70% trending + 30% personalised<br>' +
    '5+ engagements → <b style="color:#c084fc">personalized</b>: full IDF-weighted profile'
  );
  await pause(5000);

  const coldFeed = await fetchJson(`${BASE}/api/feed/u9?limit=5`);
  await showApiResponse(page, {
    title: 'Cold Start Feed — u9 (new user)',
    method: 'GET', endpoint: '/api/feed/u9?limit=5',
    data: coldFeed, highlight: 'strategy',
  });
  await pause(6000);

  // ── 6. Personalised feed ──────────────────────────────────────────────────
  await showSlide(page,
    'Personalised Recommendation',
    'Feed formula: <b style="color:#c084fc">0.40×venueMatch + 0.30×socialScore + 0.25×temporalScore + 0.05×freshness</b><br>' +
    'IDF weighting: "jazz clubs" scores higher than "restaurants" because fewer users share it'
  );
  await pause(5000);

  const alexFeed = await fetchJson(`${BASE}/api/feed/u1?limit=5`);
  await showApiResponse(page, {
    title: 'Personalised Feed — Alex Chen (u1) — Jazz + Omakase',
    method: 'GET', endpoint: '/api/feed/u1?limit=5',
    data: alexFeed, highlight: 'venueMatch',
  });
  await pause(7000);

  // Different user — different ranking
  const marcusFeed = await fetchJson(`${BASE}/api/feed/u3?limit=5`);
  await showApiResponse(page, {
    title: 'Personalised Feed — Marcus Williams (u3) — Sports Bars',
    method: 'GET', endpoint: '/api/feed/u3?limit=5',
    data: marcusFeed, highlight: 'strategy',
  });
  await pause(6000);

  // ── 7. People & temporal matching ────────────────────────────────────────
  await showSlide(page,
    'People + Temporal Matching',
    'Each recommendation includes <b style="color:#c084fc">suggested people</b> (friends who\'d enjoy this venue)<br>' +
    'and a <b style="color:#c084fc">best time</b> (friend availability × venue sweet spot × user habits)'
  );
  await pause(5000);

  const venueWithProof = await fetchJson(`${BASE}/api/venues/v1?userId=u1`);
  await showApiResponse(page, {
    title: 'Social Proof + Suggested People — v1 from u1\'s perspective',
    method: 'GET', endpoint: '/api/venues/v1?userId=u1',
    data: venueWithProof, highlight: 'suggestedPeople',
  });
  await pause(7000);

  // ── 8. Express interest ───────────────────────────────────────────────────
  await showSlide(page,
    'Social Graph Propagation',
    'Step 1: User expresses interest<br>' +
    'Step 2: Signal propagates depth-1 (full weight) and depth-2 (0.3× dampening)<br>' +
    'Step 3: Friends see venue with social proof → more likely to act boldly'
  );
  await pause(5000);

  const { default: fetch } = await import('node-fetch');
  const interestResp = await fetch(`${BASE}/api/interests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: 'u2', venueId: 'v1', level: 'interested' }),
  });
  const interest = await interestResp.json();
  await showApiResponse(page, {
    title: 'Express Interest — Sarah Kim (u2) → Blue Note v1',
    method: 'POST', endpoint: '/api/interests',
    data: interest, highlight: 'level',
  });
  await pause(5000);

  // Feed refresh shows propagated signal
  const alexFeedAfter = await fetchJson(`${BASE}/api/feed/u1?limit=5`);
  await showApiResponse(page, {
    title: 'Alex\'s Feed After Sarah\'s Interest Propagates',
    method: 'GET', endpoint: '/api/feed/u1?limit=5',
    data: alexFeedAfter, highlight: 'socialScore',
  });
  await pause(6000);

  // ── 9. Flywheel ───────────────────────────────────────────────────────────
  await showSlide(page,
    'Social Proof Flywheel',
    'Each engagement makes the venue more visible → next wave acts more boldly<br>' +
    'momentumTrend: <b style="color:#c084fc">cold → warming → hot → peaking</b>'
  );
  await pause(5000);

  // Fire a few more interests to build momentum
  for (const uid of ['u3', 'u4']) {
    await fetch(`${BASE}/api/interests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: uid, venueId: 'v1', level: 'planning' }),
    });
  }
  await pause(1000);

  const proofAfter = await fetchJson(`${BASE}/api/venues/v1?userId=u1`);
  await showApiResponse(page, {
    title: 'Social Proof After Multiple Interests — Flywheel Building',
    method: 'GET', endpoint: '/api/venues/v1?userId=u1',
    data: proofAfter, highlight: 'momentumTrend',
  });
  await pause(7000);

  // ── 10. Plans ─────────────────────────────────────────────────────────────
  await showSlide(page,
    'Plans & Social Coordination',
    'open → confirmed → completed lifecycle<br>' +
    'Confirmed plans generate the <b style="color:#c084fc">highest-weight social proof signal</b> (weight = 0.9)<br>' +
    'Invitations create an urgency loop back into the flywheel'
  );
  await pause(5000);

  const planResp = await fetch(`${BASE}/api/plans`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      venueId: 'v1',
      createdBy: 'u1',
      scheduledTime: new Date(Date.now() + 86400000 * 3).toISOString(),
      inviteeIds: ['u2', 'u3'],
    }),
  });
  const plan = await planResp.json();
  await showApiResponse(page, {
    title: 'Create Plan — Alex invites Sarah + Marcus to Blue Note',
    method: 'POST', endpoint: '/api/plans',
    data: plan, highlight: 'status',
  });
  await pause(6000);

  // Accept invitation
  const respondResp = await fetch(`${BASE}/api/plans/${plan.id}/respond`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: 'u2', response: 'accepted' }),
  });
  const respondData = await respondResp.json();
  await showApiResponse(page, {
    title: 'Sarah Accepts the Invitation',
    method: 'POST', endpoint: `/api/plans/${plan.id}/respond`,
    data: respondData, highlight: 'response',
  });
  await pause(5000);

  // ── 11. AI Booking Agent ──────────────────────────────────────────────────
  await showSlide(page,
    'AI Booking Agent (Bonus)',
    'Claude Haiku reads venue + plan + party size<br>' +
    'Returns a structured <b style="color:#c084fc">confirmationCode</b> or unavailability reason<br>' +
    'Falls back to mock if no API key is set'
  );
  await pause(5000);

  const bookResp = await fetch(`${BASE}/api/plans/${plan.id}/book`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  const booking = await bookResp.json();
  await showApiResponse(page, {
    title: 'AI Booking Agent — Plan Booked',
    method: 'POST', endpoint: `/api/plans/${plan.id}/book`,
    data: booking, highlight: 'confirmationCode',
  });
  await pause(6000);

  // ── 12. Async event pipeline ──────────────────────────────────────────────
  await showSlide(page,
    'Event-Driven Pipeline',
    'POST /api/events returns HTTP 200 immediately<br>' +
    'setImmediate() fires graph propagation after response — HTTP never blocks<br>' +
    'Event types: venue_view · venue_skip · venue_share · interest_expressed · plan_created · booking_completed'
  );
  await pause(5000);

  const eventResp = await fetch(`${BASE}/api/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'venue_view', userId: 'u1', venueId: 'v4' }),
  });
  const eventData = await eventResp.json();
  await showApiResponse(page, {
    title: 'Async Event Pipeline — Instant HTTP 200',
    method: 'POST', endpoint: '/api/events',
    data: eventData, highlight: 'accepted',
  });
  await pause(5000);

  // ── 13. User interest history ─────────────────────────────────────────────
  const engagements = await fetchJson(`${BASE}/api/interests/u1`);
  await showApiResponse(page, {
    title: 'Interest History — Signals Feeding Alex\'s Profile',
    method: 'GET', endpoint: '/api/interests/u1',
    data: engagements, highlight: 'level',
  });
  await pause(6000);

  // ── 14. Friends / social graph ────────────────────────────────────────────
  const friends = await fetchJson(`${BASE}/api/users/u1/friends`);
  await showApiResponse(page, {
    title: 'Social Graph — Alex\'s Friends with Edge Strengths',
    method: 'GET', endpoint: '/api/users/u1/friends',
    data: friends, highlight: 'initiatorScore',
  });
  await pause(6000);

  // ── 15. Closing slide ─────────────────────────────────────────────────────
  await showSlide(page,
    'Luna Social — Track 2 Complete',
    'Venue Curation · IDF Personalisation · Cold Start · People + Time Matching<br>' +
    'Social Graph Propagation · Flywheel · Plans · AI Booking · Async Events<br><br>' +
    '<span style="color:#7c3aed;font-size:16px">github.com/BMG2001nyu/recommendation-engine-social-backend</span>'
  );
  await pause(6000);

  await ctx.close();
  await browser.close();

  console.log('\n✅ Recording saved to:', OUT_DIR);
  console.log('   Look for a .webm file in that folder.\n');
})();
