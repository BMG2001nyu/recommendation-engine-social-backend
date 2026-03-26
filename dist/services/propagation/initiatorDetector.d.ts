export declare function rankByInitiatorPotential(userIds: string[]): string[];
/**
 * For each user, compute:
 *   initiatorScore = plan_created_count / max(1, total_engagement_count)
 *
 * Update social_edges.initiator_score for all edges where user_id = that user.
 */
export declare function updateInitiatorScores(): void;
//# sourceMappingURL=initiatorDetector.d.ts.map