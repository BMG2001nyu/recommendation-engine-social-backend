/**
 * Return the fraction (0–1) of friendIds who are marked available
 * at the given day-of-week + hour slot.
 */
export declare function getFriendAvailability(friendIds: string[], timeSlot: {
    dayOfWeek: number;
    hour: number;
}): number;
/**
 * Derive the user's preferred slots from their engagement event timestamps.
 * Returns the top 10 (dayOfWeek, hour) pairs scored 0–1.
 */
export declare function getPreferredSlots(userId: string): Array<{
    dayOfWeek: number;
    hour: number;
    score: number;
}>;
//# sourceMappingURL=availabilityModel.d.ts.map