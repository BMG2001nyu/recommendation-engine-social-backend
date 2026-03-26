import type { Recommendation, SocialProof } from '../../types';
export declare function detectColdStart(userId: string): {
    isColdStart: boolean;
    isHybrid: boolean;
    engagementCount: number;
};
export declare function getSocialProofForVenue(venueId: string, userId: string): SocialProof;
export declare function generateFeed(userId: string, limit?: number): Promise<Recommendation[]>;
//# sourceMappingURL=engine.d.ts.map