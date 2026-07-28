import type { CrewSlot, GameRequest, Match, RequestableSlot } from './types';
import {
  CREW_SLOTS,
  crewBlocks,
  crewPeople,
  emptyCrewBlocks,
  rolesNeededForMatch,
} from './types';

/**
 * Matches an official may request (Q-A3): released / needs-official, not draft/cancelled.
 * Open if empty MO blocks remain, or still filling crew after teams confirmed.
 */
export function isMatchRequestable(match: Match): boolean {
  if (match.status === 'draft' || match.status === 'cancelled') return false;
  if (
    match.status === 'postponed' ||
    match.status === 'locked_confirmed'
  ) {
    return false;
  }
  if (emptyCrewBlocks(match.crew.mo).length > 0) return true;
  if (crewPeople(match.crew.mo).length === 0) return true;
  return (
    match.status === 'team_confirmed' ||
    match.status === 'needs_reassignment' ||
    match.status === 'crew_pending' ||
    match.status === 'pending_team_review' ||
    match.status === 'needs_reconfirmation'
  );
}

/** Kickoff is still in the future. */
export function isKickoffUpcoming(match: Match, nowMs = Date.now()): boolean {
  return new Date(match.kickoffAt).getTime() > nowMs;
}

/** No raise-hand positions left (no empty capacity blocks). */
export function isMatchFilled(match: Match): boolean {
  return openRequestSlots(match).length === 0;
}

/** Crew slots that still have at least one empty block. */
export function openCrewSlots(match: Match): CrewSlot[] {
  return CREW_SLOTS.filter((s) => emptyCrewBlocks(match.crew[s]).length > 0);
}

/**
 * Open raise-hand preferred roles (unique type once).
 * A role stays open while any empty block of that type remains.
 */
export function openRequestSlots(match: Match): RequestableSlot[] {
  return rolesNeededForMatch(match).filter((s) => {
    if (s === 'cmo') return (match.cmo ?? []).some((c) => !c.userId);
    return emptyCrewBlocks(match.crew[s]).length > 0;
  });
}

export function pendingRequestForUser(
  requests: GameRequest[],
  matchId: string,
  userId: string,
): GameRequest | undefined {
  return requests.find(
    (r) =>
      r.matchId === matchId && r.userId === userId && r.status === 'pending',
  );
}

function preferredSlotIsFilled(match: Match, slot: RequestableSlot): boolean {
  if (slot === 'cmo') {
    const list = match.cmo ?? [];
    if (list.length === 0) return true;
    return list.every((c) => Boolean(c.userId));
  }
  const blocks = crewBlocks(match.crew[slot]);
  if (blocks.length === 0) return true;
  return emptyCrewBlocks(match.crew[slot]).length === 0;
}

/**
 * Pending raise-hand still belongs on Pending: kickoff upcoming, preferred
 * role (if any) still has an empty block, and the match still has open slots.
 */
export function isPendingRequestActive(
  match: Match,
  request: GameRequest,
  nowMs = Date.now(),
): boolean {
  if (request.status !== 'pending') return false;
  if (!isKickoffUpcoming(match, nowMs)) return false;
  if (match.status === 'cancelled' || match.status === 'postponed') {
    return false;
  }
  if (isMatchFilled(match)) return false;
  if (
    request.preferredSlot &&
    preferredSlotIsFilled(match, request.preferredSlot)
  ) {
    return false;
  }
  return true;
}

export function canOfficialRequestMatch(
  match: Match,
  userId: string,
  requests: GameRequest[],
  nowMs = Date.now(),
): boolean {
  if (!isKickoffUpcoming(match, nowMs)) return false;
  if (!isMatchRequestable(match)) return false;
  if (isMatchFilled(match)) return false;
  if (
    CREW_SLOTS.some((s) =>
      crewPeople(match.crew[s]).some((a) => a.userId === userId),
    )
  ) {
    return false;
  }
  if ((match.cmo ?? []).some((c) => c.userId === userId)) return false;
  if (pendingRequestForUser(requests, match.id, userId)) return false;
  return true;
}
