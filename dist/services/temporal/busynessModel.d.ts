import type { Venue } from '../../types';
/**
 * Return the busyness level (0–100) for a venue at the given date/time.
 * Falls back to 50 when the pattern data is missing or malformed.
 */
export declare function getBusynessAt(venue: Venue, date: Date): number;
/**
 * Gaussian peak at 60% busyness. Score ∈ (0, 1].
 *
 *   score = exp(-0.5 * ((busyness - 60) / 20)²)
 */
export declare function sweetSpotScore(busyness: number): number;
/**
 * For the given date, evaluate hours [18, 23] (inclusive) and return them
 * sorted by sweetSpotScore descending.
 */
export declare function findSweetSpotSlots(venue: Venue, date: Date, windowHours?: number): Array<{
    hour: number;
    score: number;
}>;
//# sourceMappingURL=busynessModel.d.ts.map