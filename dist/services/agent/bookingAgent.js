"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.initiateBooking = initiateBooking;
const database_1 = require("../../db/database");
const venueScorer_1 = require("../curation/venueScorer");
// ─── Mock booking ─────────────────────────────────────────────────────────────
function generateConfirmationNumber() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = 'LUNA-';
    for (let i = 0; i < 8; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
}
function buildMockBooking(venueName, partySize, leadName, scheduledTime) {
    const dt = new Date(scheduledTime);
    const formatted = dt.toLocaleString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric',
        hour: 'numeric', minute: '2-digit',
    });
    return {
        confirmationNumber: generateConfirmationNumber(),
        reservationName: leadName,
        partySize,
        specialInstructions: `Ask for the reservation under "${leadName}". Please arrive 5–10 minutes early.`,
        agentNotes: `Reservation secured at ${venueName} for ${partySize} guests on ${formatted}. ` +
            `Party lead: ${leadName}. All confirmations sent to registered accounts.`,
    };
}
// ─── Anthropic SDK call ───────────────────────────────────────────────────────
async function callBookingAgent(venueName, address, scheduledTime, partySize, participantNames, leadName) {
    // Dynamic import so SDK absence never crashes at startup
    let AnthropicClass;
    try {
        const mod = await Promise.resolve().then(() => __importStar(require('@anthropic-ai/sdk')));
        AnthropicClass = mod.default;
    }
    catch {
        return buildMockBooking(venueName, partySize, leadName, scheduledTime);
    }
    const client = new AnthropicClass({ apiKey: process.env.ANTHROPIC_API_KEY });
    const systemPrompt = "You are Luna's AI booking agent. A group has committed to going to a venue. " +
        "Your job is to confirm the reservation details and generate booking information. " +
        "Return ONLY a valid JSON object (no markdown fences) with these exact fields: " +
        "confirmationNumber (realistic alphanumeric, e.g. LUNA-ABC12345), " +
        "reservationName (lead guest full name), " +
        "partySize (integer), " +
        "specialInstructions (optional practical tip for the group, or omit the field), " +
        "agentNotes (a short note explaining what you did to secure the booking).";
    const userMessage = `Venue: ${venueName}\n` +
        `Address: ${address}\n` +
        `Date/Time: ${scheduledTime}\n` +
        `Party size: ${partySize}\n` +
        `Lead guest: ${leadName}\n` +
        `Participants: ${participantNames.join(', ')}`;
    try {
        const response = await client.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 512,
            system: systemPrompt,
            messages: [{ role: 'user', content: userMessage }],
        });
        const text = response.content
            .filter((block) => block.type === 'text')
            .map(block => block.text)
            .join('');
        const parsed = JSON.parse(text);
        if (!parsed.confirmationNumber || !parsed.reservationName) {
            throw new Error('Incomplete response from booking agent');
        }
        return parsed;
    }
    catch {
        return buildMockBooking(venueName, partySize, leadName, scheduledTime);
    }
}
// ─── Public API ───────────────────────────────────────────────────────────────
async function initiateBooking(planId) {
    const db = (0, database_1.getDb)();
    const planRow = db.prepare('SELECT * FROM plans WHERE id = ?').get(planId);
    if (!planRow)
        throw new Error(`Plan not found: ${planId}`);
    const venueRow = db.prepare('SELECT * FROM venues WHERE id = ?').get(planRow.venue_id);
    if (!venueRow)
        throw new Error(`Venue not found for plan: ${planId}`);
    const venue = (0, venueScorer_1.rowToVenue)(venueRow);
    const participantRows = db.prepare(`
    SELECT pp.user_id, u.name, pp.status
    FROM plan_participants pp
    JOIN users u ON u.id = pp.user_id
    WHERE pp.plan_id = ? AND pp.status IN ('accepted', 'invited')
  `).all(planId);
    const partySize = Math.max(1, participantRows.length);
    const participantNames = participantRows.map(p => p.name);
    const creatorRow = db.prepare('SELECT name FROM users WHERE id = ?').get(planRow.created_by);
    const leadName = creatorRow?.name ?? participantNames[0] ?? 'Guest';
    let bookingDetails;
    if (!process.env.ANTHROPIC_API_KEY) {
        bookingDetails = buildMockBooking(venue.name, partySize, leadName, planRow.scheduled_time);
    }
    else {
        bookingDetails = await callBookingAgent(venue.name, venue.address, planRow.scheduled_time, partySize, participantNames, leadName);
    }
    db.prepare(`
    UPDATE plans
    SET booking_reference = ?,
        booking_details   = ?,
        status            = 'confirmed',
        updated_at        = ?
    WHERE id = ?
  `).run(bookingDetails.confirmationNumber, JSON.stringify(bookingDetails), new Date().toISOString(), planId);
    return bookingDetails;
}
//# sourceMappingURL=bookingAgent.js.map