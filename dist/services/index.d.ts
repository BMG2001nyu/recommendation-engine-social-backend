/**
 * Top-level services barrel.
 * Provides CRUD helpers used by the API layer and re-exports all sub-services.
 */
import type { User, Venue, VenueEngagement, PlanWithDetails, PlanParticipant, InterestLevel, SocialProof, SocialEdge, CreatePlanRequest } from '../types';
export * from './curation';
export * from './recommendation';
export * from './propagation';
export * from './temporal';
export { initiateBooking } from './agent/bookingAgent';
export declare function getVenue(venueId: string): Venue | null;
export declare function getVenueWithSocialProof(venueId: string, userId: string): (Venue & {
    socialProof: SocialProof;
}) | null;
export declare function expressInterest(userId: string, venueId: string, level: InterestLevel): VenueEngagement;
export declare function getUserEngagements(userId: string): VenueEngagement[];
export declare function getVenueEngagements(venueId: string): VenueEngagement[];
export declare function createPlan(req: CreatePlanRequest): PlanWithDetails;
export declare function getPlan(planId: string): PlanWithDetails | null;
export declare function getUserPlans(userId: string): PlanWithDetails[];
export declare function sendInvites(planId: string, userIds: string[], invitedBy: string): PlanParticipant[];
export declare function respondToInvite(planId: string, userId: string, response: 'accepted' | 'declined' | 'maybe'): PlanParticipant;
export declare function getUserInvitations(userId: string): PlanWithDetails[];
export declare function getUser(userId: string): User | null;
export declare function getUserFriends(userId: string): Array<User & {
    edge: SocialEdge;
}>;
//# sourceMappingURL=index.d.ts.map