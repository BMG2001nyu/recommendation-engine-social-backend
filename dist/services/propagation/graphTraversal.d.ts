import type { User, SocialEdge } from '../../types';
export declare function getFriends(userId: string): Array<User & {
    edge: SocialEdge;
}>;
/**
 * Return users who share at least one mutual friend with userId
 * but are NOT direct friends of userId.
 */
export declare function getMutuals(userId: string): Array<User & {
    mutualFriendIds: string[];
}>;
export declare function getBFSNeighbors(userId: string, maxDepth?: number): Array<{
    user: User;
    depth: number;
    pathStrength: number;
}>;
/**
 * For a set of user IDs, return their average initiator_score
 * across all their outgoing social_edges.
 */
export declare function detectInitiators(userIds: string[]): Record<string, number>;
//# sourceMappingURL=graphTraversal.d.ts.map