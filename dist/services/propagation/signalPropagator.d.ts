import type { InterestLevel, PropagationResult } from '../../types';
export declare function propagateEngagement(userId: string, venueId: string, level: InterestLevel): PropagationResult;
/**
 * Sum all unexpired, unconsumed signals for targetUserId + venueId,
 * mark them consumed, and return the total boost score.
 */
export declare function consumePropagationSignals(targetUserId: string, venueId: string): number;
export declare function cleanExpiredSignals(): void;
//# sourceMappingURL=signalPropagator.d.ts.map