import type { InterestProfile } from '../../types';
/**
 * For each interest category across all users, compute an IDF-style
 * distinctiveness score.
 *
 * distinctiveness(c) = log(1 + totalUsers / max(1, usersWithCategory(c)))
 * Normalised so the maximum value becomes 1.
 */
export declare function getDistinctivenessMap(allUserIds: string[]): Record<string, number>;
export declare function buildInterestProfile(userId: string): InterestProfile;
//# sourceMappingURL=interestProfile.d.ts.map