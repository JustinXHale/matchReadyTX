import { assignmentForUser, type GameRequest, type Match } from '@/domain/types';

/** Raise-hand / crew accept status shown on referee assignment cards. */
export type AssignmentAlertStatus = 'pending' | 'approved' | 'declined';

/**
 * Resolve Pending / Approved / Declined for referee cards.
 * Prefer an explicit GameRequest (raise-hand); otherwise use crew slot state.
 */
export function resolveAssignmentAlertStatus(
  match: Match,
  userId: string,
  request?: GameRequest | null,
): AssignmentAlertStatus {
  if (request) return request.status;

  const found = assignmentForUser(match, userId);
  if (!found?.assignment?.userId) return 'pending';

  const status = found.assignment.status;
  if (status === 'confirmed') return 'approved';
  if (status === 'declined' || status === 'released') return 'declined';
  // official | pending_internal | held — assigned, waiting on accept
  return 'pending';
}

export function assignmentAlertLabel(status: AssignmentAlertStatus): string {
  if (status === 'pending') return 'Pending';
  if (status === 'approved') return 'Approved';
  return 'Declined';
}
