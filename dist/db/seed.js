"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Seed script — populates a fresh Luna DB with 10 users, 20 venues,
 * a social graph, pre-existing engagements, and availability slots.
 *
 * Run: ts-node src/db/seed.ts
 */
require("dotenv/config");
const uuid_1 = require("uuid");
const database_1 = require("./database");
// ─── Busyness helpers ─────────────────────────────────────────────────────────
function emptyWeek() {
    return Array.from({ length: 7 }, () => Array(24).fill(0));
}
/** Gaussian-like peak centred at `peakHour`, spread `sigma` hours, amplitude 0–100 */
function peak(hour, peakHour, sigma, amplitude) {
    return Math.round(amplitude * Math.exp(-0.5 * ((hour - peakHour) / sigma) ** 2));
}
function jitter(n, range = 6) {
    return Math.min(100, Math.max(0, Math.round(n + (Math.random() - 0.5) * range)));
}
function makePattern(cfg) {
    const pattern = emptyWeek();
    for (const { days, peakHour, sigma, amplitude } of cfg) {
        for (const day of days) {
            for (let h = 0; h < 24; h++) {
                pattern[day][h] = jitter(peak(h, peakHour, sigma, amplitude));
            }
        }
    }
    return pattern;
}
const BUSYNESS = {
    jazz: makePattern([
        { days: [1, 2, 3], peakHour: 21, sigma: 1.5, amplitude: 55 },
        { days: [4, 5], peakHour: 22, sigma: 1.8, amplitude: 88 },
        { days: [0, 6], peakHour: 21, sigma: 1.5, amplitude: 70 },
    ]),
    speakeasy: makePattern([
        { days: [1, 2, 3], peakHour: 22, sigma: 2, amplitude: 50 },
        { days: [4, 5], peakHour: 23, sigma: 2, amplitude: 90 },
        { days: [0, 6], peakHour: 22, sigma: 2, amplitude: 72 },
    ]),
    rooftop: makePattern([
        { days: [1, 2, 3], peakHour: 20, sigma: 2, amplitude: 60 },
        { days: [4, 5], peakHour: 20, sigma: 2.5, amplitude: 92 },
        { days: [0, 6], peakHour: 18, sigma: 3, amplitude: 80 },
    ]),
    wine_bar: makePattern([
        { days: [1, 2, 3], peakHour: 20, sigma: 2.5, amplitude: 62 },
        { days: [4, 5], peakHour: 21, sigma: 2.5, amplitude: 85 },
        { days: [0, 6], peakHour: 19, sigma: 2.5, amplitude: 68 },
    ]),
    coffee: makePattern([
        { days: [1, 2, 3, 4, 5], peakHour: 9, sigma: 2, amplitude: 85 },
        { days: [0, 6], peakHour: 10, sigma: 3, amplitude: 70 },
    ]),
    brunch: makePattern([
        { days: [0, 6], peakHour: 11, sigma: 2, amplitude: 92 },
        { days: [1, 2, 3, 4, 5], peakHour: 12, sigma: 1.5, amplitude: 50 },
    ]),
    fine_dining: makePattern([
        { days: [1, 2, 3, 4, 5], peakHour: 20, sigma: 1.5, amplitude: 75 },
        { days: [0, 6], peakHour: 20, sigma: 2, amplitude: 88 },
    ]),
    gastropub: makePattern([
        { days: [1, 2, 3], peakHour: 20, sigma: 2.5, amplitude: 65 },
        { days: [4, 5], peakHour: 21, sigma: 2.5, amplitude: 90 },
        { days: [0, 6], peakHour: 18, sigma: 3, amplitude: 78 },
    ]),
    casual: makePattern([
        { days: [1, 2, 3, 4, 5], peakHour: 13, sigma: 1.5, amplitude: 78 },
        { days: [1, 2, 3, 4, 5], peakHour: 19, sigma: 2, amplitude: 65 },
        { days: [0, 6], peakHour: 13, sigma: 2, amplitude: 72 },
    ]),
};
// ─── Data ─────────────────────────────────────────────────────────────────────
const USERS = [
    { id: 'u1', name: 'Alex Chen', email: 'alex@luna.test', lat: 40.7484, lng: -73.9967, city: 'New York' },
    { id: 'u2', name: 'Sarah Kim', email: 'sarah@luna.test', lat: 40.7282, lng: -73.9942, city: 'New York' },
    { id: 'u3', name: 'Marcus Williams', email: 'marcus@luna.test', lat: 40.7614, lng: -73.9776, city: 'New York' },
    { id: 'u4', name: 'Emma Rodriguez', email: 'emma@luna.test', lat: 40.7359, lng: -74.0013, city: 'New York' },
    { id: 'u5', name: 'Jake Park', email: 'jake@luna.test', lat: 40.7218, lng: -74.0045, city: 'New York' },
    { id: 'u6', name: 'Priya Patel', email: 'priya@luna.test', lat: 40.7061, lng: -74.0087, city: 'New York' },
    { id: 'u7', name: 'Tom Anderson', email: 'tom@luna.test', lat: 40.7523, lng: -73.9854, city: 'New York' },
    { id: 'u8', name: 'Lisa Chen', email: 'lisa@luna.test', lat: 40.7195, lng: -73.9902, city: 'New York' },
    { id: 'u9', name: 'David Kim', email: 'david@luna.test', lat: 40.7549, lng: -74.0020, city: 'New York' },
    { id: 'u10', name: 'Rachel Green', email: 'rachel@luna.test', lat: 40.7421, lng: -73.9889, city: 'New York' },
];
const INTERESTS = [
    // Alex — jazz + omakase + rooftops (distinctive interests → high weight)
    { userId: 'u1', category: 'jazz clubs', weight: 0.95, source: 'explicit', engagementCount: 12 },
    { userId: 'u1', category: 'omakase', weight: 0.90, source: 'explicit', engagementCount: 8 },
    { userId: 'u1', category: 'rooftop bars', weight: 0.80, source: 'behavioral', engagementCount: 9 },
    { userId: 'u1', category: 'cocktail bars', weight: 0.65, source: 'inferred', engagementCount: 5 },
    // Sarah — coffee + brunch + art
    { userId: 'u2', category: 'coffee shops', weight: 0.85, source: 'explicit', engagementCount: 14 },
    { userId: 'u2', category: 'brunch spots', weight: 0.80, source: 'behavioral', engagementCount: 11 },
    { userId: 'u2', category: 'art galleries', weight: 0.75, source: 'explicit', engagementCount: 7 },
    { userId: 'u2', category: 'restaurants', weight: 0.40, source: 'inferred', engagementCount: 3 },
    // Marcus — craft beer + sports + rooftops
    { userId: 'u3', category: 'craft beer bars', weight: 0.90, source: 'explicit', engagementCount: 15 },
    { userId: 'u3', category: 'sports bars', weight: 0.80, source: 'explicit', engagementCount: 10 },
    { userId: 'u3', category: 'rooftop bars', weight: 0.70, source: 'behavioral', engagementCount: 6 },
    { userId: 'u3', category: 'gastropubs', weight: 0.75, source: 'behavioral', engagementCount: 8 },
    // Emma — wine + Italian + date spots
    { userId: 'u4', category: 'wine bars', weight: 0.92, source: 'explicit', engagementCount: 13 },
    { userId: 'u4', category: 'Italian', weight: 0.85, source: 'explicit', engagementCount: 10 },
    { userId: 'u4', category: 'fine dining', weight: 0.80, source: 'behavioral', engagementCount: 7 },
    { userId: 'u4', category: 'cocktail bars', weight: 0.60, source: 'inferred', engagementCount: 4 },
    // Jake — speakeasies + cocktails + jazz
    { userId: 'u5', category: 'speakeasies', weight: 0.95, source: 'explicit', engagementCount: 14 },
    { userId: 'u5', category: 'cocktail bars', weight: 0.85, source: 'explicit', engagementCount: 11 },
    { userId: 'u5', category: 'jazz clubs', weight: 0.80, source: 'behavioral', engagementCount: 9 },
    { userId: 'u5', category: 'wine bars', weight: 0.55, source: 'inferred', engagementCount: 4 },
    // Priya — Indian + vegetarian + yoga cafes
    { userId: 'u6', category: 'Indian cuisine', weight: 0.90, source: 'explicit', engagementCount: 12 },
    { userId: 'u6', category: 'vegetarian', weight: 0.85, source: 'explicit', engagementCount: 10 },
    { userId: 'u6', category: 'yoga cafes', weight: 0.80, source: 'explicit', engagementCount: 8 },
    { userId: 'u6', category: 'coffee shops', weight: 0.55, source: 'behavioral', engagementCount: 5 },
    // Tom — burgers + sports + craft beer
    { userId: 'u7', category: 'burger joints', weight: 0.88, source: 'explicit', engagementCount: 16 },
    { userId: 'u7', category: 'sports bars', weight: 0.85, source: 'explicit', engagementCount: 13 },
    { userId: 'u7', category: 'craft beer bars', weight: 0.78, source: 'behavioral', engagementCount: 8 },
    { userId: 'u7', category: 'gastropubs', weight: 0.65, source: 'inferred', engagementCount: 5 },
    // Lisa — rooftops + brunch + sushi
    { userId: 'u8', category: 'rooftop bars', weight: 0.92, source: 'explicit', engagementCount: 11 },
    { userId: 'u8', category: 'brunch spots', weight: 0.82, source: 'explicit', engagementCount: 9 },
    { userId: 'u8', category: 'sushi', weight: 0.88, source: 'explicit', engagementCount: 10 },
    { userId: 'u8', category: 'cocktail bars', weight: 0.60, source: 'inferred', engagementCount: 4 },
    // David — jazz + cocktails + wine
    { userId: 'u9', category: 'jazz clubs', weight: 0.95, source: 'explicit', engagementCount: 14 },
    { userId: 'u9', category: 'cocktail bars', weight: 0.88, source: 'explicit', engagementCount: 12 },
    { userId: 'u9', category: 'wine bars', weight: 0.82, source: 'explicit', engagementCount: 9 },
    { userId: 'u9', category: 'speakeasies', weight: 0.75, source: 'behavioral', engagementCount: 7 },
    // Rachel — vegan + coffee + art
    { userId: 'u10', category: 'vegan', weight: 0.92, source: 'explicit', engagementCount: 15 },
    { userId: 'u10', category: 'coffee shops', weight: 0.80, source: 'explicit', engagementCount: 11 },
    { userId: 'u10', category: 'art galleries', weight: 0.78, source: 'explicit', engagementCount: 8 },
    { userId: 'u10', category: 'vegetarian', weight: 0.85, source: 'behavioral', engagementCount: 10 },
];
const VENUES = [
    {
        id: 'v1', name: 'Blue Note Jazz Club', category: 'jazz clubs',
        tags: ['jazz', 'live music', 'cocktails', 'intimate', 'late night'],
        lat: 40.7301, lng: -74.0013, address: '131 W 3rd St', city: 'New York',
        rating: 4.7, priceLevel: 3, busynessPattern: BUSYNESS.jazz,
        photos: ['blue-note-1.jpg', 'blue-note-2.jpg'],
        vibeDescription: 'Legendary underground jazz venue. Intimate booths, world-class musicians, and stiff drinks. The kind of place that makes New York feel magical.',
        qualityScore: 0.93, trendingScore: 0.72, engagementCount: 248,
    },
    {
        id: 'v2', name: 'Employees Only', category: 'speakeasies',
        tags: ['speakeasy', 'cocktails', 'late night', 'intimate', 'craft drinks'],
        lat: 40.7340, lng: -74.0039, address: '510 Hudson St', city: 'New York',
        rating: 4.6, priceLevel: 3, busynessPattern: BUSYNESS.speakeasy,
        photos: ['eo-1.jpg', 'eo-2.jpg'],
        vibeDescription: 'Behind the psychic\'s sign lies one of NYC\'s best cocktail bars. Expert bartenders, classic recipes, perfect strangers becoming friends by midnight.',
        qualityScore: 0.91, trendingScore: 0.68, engagementCount: 312,
    },
    {
        id: 'v3', name: 'The Standard High Line', category: 'rooftop bars',
        tags: ['rooftop', 'views', 'cocktails', 'trendy', 'hotel bar'],
        lat: 40.7424, lng: -74.0076, address: '848 Washington St', city: 'New York',
        rating: 4.4, priceLevel: 4, busynessPattern: BUSYNESS.rooftop,
        photos: ['standard-1.jpg', 'standard-2.jpg'],
        vibeDescription: 'Sky-high views over the Hudson and Meatpacking. The crowd is beautiful, the drinks expensive, and the sunset views worth every penny.',
        qualityScore: 0.87, trendingScore: 0.85, engagementCount: 421,
    },
    {
        id: 'v4', name: 'Attaboy', category: 'speakeasies',
        tags: ['speakeasy', 'no-menu', 'cocktails', 'craft', 'LES'],
        lat: 40.7189, lng: -73.9880, address: '134 Eldridge St', city: 'New York',
        rating: 4.8, priceLevel: 3, busynessPattern: BUSYNESS.speakeasy,
        photos: ['attaboy-1.jpg', 'attaboy-2.jpg'],
        vibeDescription: 'No menu. Tell them what you like and the bartender builds your perfect cocktail. Tiny, buzzy, and impossibly good. Regulars only.',
        qualityScore: 0.95, trendingScore: 0.61, engagementCount: 189,
    },
    {
        id: 'v5', name: 'Bemelmans Bar', category: 'jazz clubs',
        tags: ['jazz', 'cocktails', 'upscale', 'classic NYC', 'Carlyle Hotel'],
        lat: 40.7740, lng: -73.9636, address: '35 E 76th St', city: 'New York',
        rating: 4.7, priceLevel: 4, busynessPattern: BUSYNESS.jazz,
        photos: ['bemelmans-1.jpg', 'bemelmans-2.jpg'],
        vibeDescription: 'Gold-leaf murals, live jazz piano, and impeccable martinis at the Carlyle. The most civilised room in New York. A portal to another era.',
        qualityScore: 0.92, trendingScore: 0.55, engagementCount: 167,
    },
    {
        id: 'v6', name: 'Gramercy Terrace', category: 'rooftop bars',
        tags: ['rooftop', 'views', 'cocktails', 'Gramercy', 'summer'],
        lat: 40.7387, lng: -73.9840, address: '2 Lexington Ave', city: 'New York',
        rating: 4.3, priceLevel: 3, busynessPattern: BUSYNESS.rooftop,
        photos: ['gramercy-1.jpg'],
        vibeDescription: 'Open-air rooftop in the heart of Gramercy. Easy crowd, strong drinks, and panoramic city views without the Meatpacking attitude.',
        qualityScore: 0.81, trendingScore: 0.78, engagementCount: 356,
    },
    {
        id: 'v7', name: 'Torrisi', category: 'Italian',
        tags: ['Italian', 'wine', 'pasta', 'upscale', 'date night'],
        lat: 40.7226, lng: -73.9966, address: '250 Mulberry St', city: 'New York',
        rating: 4.6, priceLevel: 4, busynessPattern: BUSYNESS.fine_dining,
        photos: ['torrisi-1.jpg', 'torrisi-2.jpg'],
        vibeDescription: 'Intimate Italian with insanely good handmade pasta and a natural wine list that would make a sommelier weep. The room buzzes.',
        qualityScore: 0.90, trendingScore: 0.70, engagementCount: 203,
    },
    {
        id: 'v8', name: 'Frenchette Wine Bar', category: 'wine bars',
        tags: ['wine bar', 'natural wine', 'French', 'date spot', 'Tribeca'],
        lat: 40.7194, lng: -74.0092, address: '241 W Broadway', city: 'New York',
        rating: 4.5, priceLevel: 3, busynessPattern: BUSYNESS.wine_bar,
        photos: ['frenchette-1.jpg'],
        vibeDescription: 'Natural wine and French-influenced small plates in a candlelit Tribeca townhouse. Unpretentious, delicious, and somehow always just-discovered.',
        qualityScore: 0.88, trendingScore: 0.74, engagementCount: 287,
    },
    {
        id: 'v9', name: 'Joe Coffee — West Village', category: 'coffee shops',
        tags: ['coffee', 'specialty', 'work-friendly', 'West Village', 'cozy'],
        lat: 40.7333, lng: -74.0029, address: '141 Waverly Pl', city: 'New York',
        rating: 4.5, priceLevel: 1, busynessPattern: BUSYNESS.coffee,
        photos: ['joe-1.jpg', 'joe-2.jpg'],
        vibeDescription: 'NYC\'s gold standard for specialty coffee. Knowledgeable staff, carefully sourced beans, and a neighbourhood crowd who take their cortados seriously.',
        qualityScore: 0.85, trendingScore: 0.52, engagementCount: 512,
    },
    {
        id: 'v10', name: 'Russ & Daughters Cafe', category: 'brunch spots',
        tags: ['brunch', 'bagels', 'Jewish deli', 'Lower East Side', 'iconic'],
        lat: 40.7179, lng: -73.9887, address: '127 Orchard St', city: 'New York',
        rating: 4.6, priceLevel: 2, busynessPattern: BUSYNESS.brunch,
        photos: ['rnd-1.jpg', 'rnd-2.jpg'],
        vibeDescription: 'The platonic ideal of a New York bagel. A century of smoked fish, cream cheese, and perfectly cured salmon. Sunday mornings as religion.',
        qualityScore: 0.91, trendingScore: 0.80, engagementCount: 476,
    },
    {
        id: 'v11', name: 'Balthazar', category: 'brunch spots',
        tags: ['brunch', 'French bistro', 'SoHo', 'classic', 'iconic'],
        lat: 40.7230, lng: -73.9986, address: '80 Spring St', city: 'New York',
        rating: 4.5, priceLevel: 3, busynessPattern: BUSYNESS.brunch,
        photos: ['balthazar-1.jpg', 'balthazar-2.jpg'],
        vibeDescription: 'The grande dame of New York brunch. Art deco mirrors, steak frites, and crusty baguettes. Reservations are hard to get for a reason.',
        qualityScore: 0.89, trendingScore: 0.67, engagementCount: 389,
    },
    {
        id: 'v12', name: 'Dirt Candy', category: 'vegetarian',
        tags: ['vegetarian', 'vegan', 'creative', 'East Village', 'tasting menu'],
        lat: 40.7244, lng: -73.9844, address: '86 Allen St', city: 'New York',
        rating: 4.7, priceLevel: 3, busynessPattern: BUSYNESS.fine_dining,
        photos: ['dirtcandy-1.jpg'],
        vibeDescription: 'Amanda Cohen\'s wildly creative vegetable restaurant. Broccoli hot dogs, sweet potato waffles, dishes that make you forget you\'re eating plants.',
        qualityScore: 0.90, trendingScore: 0.73, engagementCount: 224,
    },
    {
        id: 'v13', name: 'The Spotted Pig', category: 'gastropubs',
        tags: ['gastropub', 'West Village', 'burgers', 'craft beer', 'late night'],
        lat: 40.7339, lng: -74.0081, address: '314 W 11th St', city: 'New York',
        rating: 4.4, priceLevel: 2, busynessPattern: BUSYNESS.gastropub,
        photos: ['spotted-pig-1.jpg', 'spotted-pig-2.jpg'],
        vibeDescription: 'The greatest bar burger in New York, period. Charred bun, Roquefort cheese, shoestring fries. Cramped, loud, and utterly perfect.',
        qualityScore: 0.86, trendingScore: 0.88, engagementCount: 445,
    },
    {
        id: 'v14', name: 'Roberta\'s', category: 'pizza',
        tags: ['pizza', 'Bushwick', 'wood-fired', 'outdoor', 'craft beer'],
        lat: 40.7051, lng: -73.9333, address: '261 Moore St', city: 'New York',
        rating: 4.5, priceLevel: 2, busynessPattern: BUSYNESS.casual,
        photos: ['robertas-1.jpg', 'robertas-2.jpg'],
        vibeDescription: 'Wood-fired Neapolitan pizza in a shipping container compound in Bushwick. Charred crusts, garden herbs, and the definitive Brooklyn night out.',
        qualityScore: 0.88, trendingScore: 0.82, engagementCount: 398,
    },
    {
        id: 'v15', name: 'Metrograph Commissary', category: 'coffee shops',
        tags: ['coffee', 'art house', 'cinema', 'Lower East Side', 'creative'],
        lat: 40.7167, lng: -73.9895, address: '7 Ludlow St', city: 'New York',
        rating: 4.3, priceLevel: 2, busynessPattern: BUSYNESS.coffee,
        photos: ['metrograph-1.jpg'],
        vibeDescription: 'Inside a beloved arthouse cinema. Exceptional coffee, film books, and the best people-watching on the Lower East Side.',
        qualityScore: 0.82, trendingScore: 0.65, engagementCount: 178,
    },
    {
        id: 'v16', name: 'Eleven Madison Park', category: 'fine dining',
        tags: ['fine dining', 'tasting menu', 'vegan', 'Michelin', 'occasion'],
        lat: 40.7416, lng: -73.9872, address: '11 Madison Ave', city: 'New York',
        rating: 4.9, priceLevel: 4, busynessPattern: BUSYNESS.fine_dining,
        photos: ['emp-1.jpg', 'emp-2.jpg'],
        vibeDescription: 'The pinnacle. Three Michelin stars, a fully plant-based menu, and a room that makes every occasion feel monumental. Reserve three months out.',
        qualityScore: 0.98, trendingScore: 0.55, engagementCount: 98,
    },
    {
        id: 'v17', name: 'Casa Dani — Omakase', category: 'omakase',
        tags: ['omakase', 'sushi', 'Japanese', 'Chelsea', 'premium'],
        lat: 40.7453, lng: -74.0019, address: '30 W 30th St', city: 'New York',
        rating: 4.8, priceLevel: 4, busynessPattern: BUSYNESS.fine_dining,
        photos: ['casadani-1.jpg'],
        vibeDescription: 'Counter seats, masterful nigiri, and a chef who knows your name by dessert. The omakase experience at its most personal.',
        qualityScore: 0.94, trendingScore: 0.66, engagementCount: 134,
    },
    {
        id: 'v18', name: 'Monkey Bar', category: 'cocktail bars',
        tags: ['cocktail bar', 'classic NYC', 'Midtown', 'supper club', 'jazz'],
        lat: 40.7580, lng: -73.9753, address: '60 E 54th St', city: 'New York',
        rating: 4.4, priceLevel: 3, busynessPattern: BUSYNESS.wine_bar,
        photos: ['monkey-1.jpg'],
        vibeDescription: 'Old-school Manhattan supper club with murals, monkey motifs, and some of the city\'s most artfully made cocktails. Timeless.',
        qualityScore: 0.85, trendingScore: 0.60, engagementCount: 211,
    },
    {
        id: 'v19', name: 'Nowadays', category: 'craft beer bars',
        tags: ['craft beer', 'outdoor', 'Ridgewood', 'late night', 'music'],
        lat: 40.7050, lng: -73.9020, address: '56-06 Cooper Ave', city: 'New York',
        rating: 4.4, priceLevel: 2, busynessPattern: BUSYNESS.rooftop,
        photos: ['nowadays-1.jpg', 'nowadays-2.jpg'],
        vibeDescription: 'Sprawling outdoor bar and music venue in Ridgewood. Cold craft beers, fire pits in winter, and DJs who actually care about the music.',
        qualityScore: 0.84, trendingScore: 0.91, engagementCount: 367,
    },
    {
        id: 'v20', name: 'Via Carota', category: 'Italian',
        tags: ['Italian', 'West Village', 'pasta', 'brunch', 'iconic'],
        lat: 40.7329, lng: -74.0056, address: '51 Grove St', city: 'New York',
        rating: 4.7, priceLevel: 2, busynessPattern: BUSYNESS.fine_dining,
        photos: ['viacarota-1.jpg', 'viacarota-2.jpg'],
        vibeDescription: 'Perfect Roman trattoria in the West Village. Simple pastas, great Negronis, and a room that feels like it has always been there. Always a queue.',
        qualityScore: 0.92, trendingScore: 0.89, engagementCount: 503,
    },
];
// Edge direction: userId knows friendId. Bidirectional edges stored separately.
const SOCIAL_EDGES = [
    { userId: 'u1', friendId: 'u2', strength: 0.90, initiatorScore: 0.85, mutualFriends: 3 },
    { userId: 'u1', friendId: 'u3', strength: 0.75, initiatorScore: 0.70, mutualFriends: 2 },
    { userId: 'u1', friendId: 'u4', strength: 0.65, initiatorScore: 0.55, mutualFriends: 1 },
    { userId: 'u1', friendId: 'u8', strength: 0.55, initiatorScore: 0.50, mutualFriends: 1 },
    { userId: 'u2', friendId: 'u10', strength: 0.85, initiatorScore: 0.60, mutualFriends: 2 },
    { userId: 'u2', friendId: 'u6', strength: 0.72, initiatorScore: 0.55, mutualFriends: 1 },
    { userId: 'u2', friendId: 'u8', strength: 0.65, initiatorScore: 0.50, mutualFriends: 2 },
    { userId: 'u3', friendId: 'u7', strength: 0.92, initiatorScore: 0.88, mutualFriends: 4 },
    { userId: 'u3', friendId: 'u5', strength: 0.62, initiatorScore: 0.65, mutualFriends: 1 },
    { userId: 'u4', friendId: 'u9', strength: 0.82, initiatorScore: 0.70, mutualFriends: 3 },
    { userId: 'u4', friendId: 'u5', strength: 0.73, initiatorScore: 0.60, mutualFriends: 2 },
    { userId: 'u5', friendId: 'u9', strength: 0.91, initiatorScore: 0.75, mutualFriends: 3 },
    { userId: 'u5', friendId: 'u3', strength: 0.62, initiatorScore: 0.65, mutualFriends: 1 },
    { userId: 'u7', friendId: 'u3', strength: 0.92, initiatorScore: 0.88, mutualFriends: 4 },
    { userId: 'u7', friendId: 'u5', strength: 0.52, initiatorScore: 0.55, mutualFriends: 1 },
    { userId: 'u8', friendId: 'u1', strength: 0.55, initiatorScore: 0.50, mutualFriends: 1 },
    { userId: 'u8', friendId: 'u2', strength: 0.65, initiatorScore: 0.50, mutualFriends: 2 },
    { userId: 'u9', friendId: 'u4', strength: 0.82, initiatorScore: 0.70, mutualFriends: 3 },
    { userId: 'u9', friendId: 'u5', strength: 0.91, initiatorScore: 0.75, mutualFriends: 3 },
    { userId: 'u10', friendId: 'u2', strength: 0.85, initiatorScore: 0.60, mutualFriends: 2 },
    { userId: 'u10', friendId: 'u6', strength: 0.70, initiatorScore: 0.55, mutualFriends: 1 },
];
// Pre-existing engagements to seed social proof
const ENGAGEMENTS = [
    { userId: 'u1', venueId: 'v1', level: 'interested' },
    { userId: 'u5', venueId: 'v1', level: 'interested' },
    { userId: 'u9', venueId: 'v1', level: 'planning' },
    { userId: 'u4', venueId: 'v1', level: 'interested' },
    { userId: 'u1', venueId: 'v4', level: 'planning' },
    { userId: 'u5', venueId: 'v4', level: 'confirmed' },
    { userId: 'u9', venueId: 'v4', level: 'confirmed' },
    { userId: 'u3', venueId: 'v13', level: 'planning' },
    { userId: 'u7', venueId: 'v13', level: 'confirmed' },
    { userId: 'u1', venueId: 'v17', level: 'interested' },
    { userId: 'u8', venueId: 'v17', level: 'interested' },
    { userId: 'u4', venueId: 'v8', level: 'confirmed' },
    { userId: 'u9', venueId: 'v8', level: 'interested' },
    { userId: 'u2', venueId: 'v10', level: 'attended' },
    { userId: 'u10', venueId: 'v10', level: 'interested' },
    { userId: 'u6', venueId: 'v12', level: 'interested' },
    { userId: 'u10', venueId: 'v12', level: 'planning' },
    { userId: 'u3', venueId: 'v19', level: 'interested' },
    { userId: 'u7', venueId: 'v19', level: 'interested' },
    { userId: 'u1', venueId: 'v3', level: 'viewed' },
    { userId: 'u8', venueId: 'v3', level: 'interested' },
    { userId: 'u2', venueId: 'v20', level: 'attended' },
    { userId: 'u4', venueId: 'v20', level: 'interested' },
];
// Available evenings (Friday + Saturday) for all users
function availabilitySlots() {
    const rows = [];
    for (const u of USERS) {
        // Everyone available Fri (5) and Sat (6) evenings 18–23
        for (const day of [5, 6]) {
            for (let h = 18; h <= 23; h++) {
                rows.push({ id: (0, uuid_1.v4)(), userId: u.id, dayOfWeek: day, hour: h });
            }
        }
        // Weekday evenings for 4 random users
        if (['u1', 'u5', 'u7', 'u9'].includes(u.id)) {
            for (const day of [2, 3, 4]) {
                for (let h = 19; h <= 22; h++) {
                    rows.push({ id: (0, uuid_1.v4)(), userId: u.id, dayOfWeek: day, hour: h });
                }
            }
        }
    }
    return rows;
}
// ─── Runner ───────────────────────────────────────────────────────────────────
function run() {
    const db = (0, database_1.getDb)();
    const insertUser = db.prepare('INSERT OR REPLACE INTO users (id, name, email, lat, lng, city) VALUES (?, ?, ?, ?, ?, ?)');
    const insertInterest = db.prepare('INSERT OR REPLACE INTO interests (id, user_id, category, weight, source, engagement_count) VALUES (?, ?, ?, ?, ?, ?)');
    const insertVenue = db.prepare(`
    INSERT OR REPLACE INTO venues
      (id, name, category, tags, lat, lng, address, city, rating, price_level,
       busyness_pattern, photos, vibe_description, quality_score, trending_score, engagement_count)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
    const insertEdge = db.prepare('INSERT OR REPLACE INTO social_edges (user_id, friend_id, strength, initiator_score, mutual_friends) VALUES (?, ?, ?, ?, ?)');
    const insertEngagement = db.prepare('INSERT OR REPLACE INTO venue_engagements (id, user_id, venue_id, level) VALUES (?, ?, ?, ?)');
    const insertSlot = db.prepare('INSERT OR REPLACE INTO availability_slots (id, user_id, day_of_week, hour) VALUES (?, ?, ?, ?)');
    const seed = db.transaction(() => {
        for (const u of USERS) {
            insertUser.run(u.id, u.name, u.email, u.lat, u.lng, u.city);
        }
        for (const i of INTERESTS) {
            insertInterest.run((0, uuid_1.v4)(), i.userId, i.category, i.weight, i.source, i.engagementCount);
        }
        for (const v of VENUES) {
            insertVenue.run(v.id, v.name, v.category, JSON.stringify(v.tags), v.lat, v.lng, v.address, v.city, v.rating, v.priceLevel, JSON.stringify(v.busynessPattern), JSON.stringify(v.photos), v.vibeDescription, v.qualityScore, v.trendingScore, v.engagementCount);
        }
        for (const e of SOCIAL_EDGES) {
            insertEdge.run(e.userId, e.friendId, e.strength, e.initiatorScore, e.mutualFriends);
        }
        for (const eng of ENGAGEMENTS) {
            insertEngagement.run((0, uuid_1.v4)(), eng.userId, eng.venueId, eng.level);
        }
        for (const slot of availabilitySlots()) {
            insertSlot.run(slot.id, slot.userId, slot.dayOfWeek, slot.hour);
        }
    });
    seed();
    console.log(`✅ Seed complete — ${USERS.length} users, ${VENUES.length} venues, ${SOCIAL_EDGES.length} edges, ${ENGAGEMENTS.length} engagements`);
}
run();
//# sourceMappingURL=seed.js.map