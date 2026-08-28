import type { CrewSlot, GameRequest, Match, RequestableSlot } from './types';
import {
  CREW_SLOTS,
  REQUESTABLE_SLOTS,
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

/** Fee crew slots still open for assignment (CMO excluded from coverage queues). */
export function openCrewSlotsExcludingCmo(match: Match): CrewSlot[] {
  return openRequestSlots(match).filter((s): s is CrewSlot => s !== 'cmo');
}

/** First empty block per open fee-crew role — tap targets for coverage assign. */
export function openCrewAssignTargets(
  match: Match,
): { slot: CrewSlot; assignmentId?: string }[] {
  return openCrewSlotsExcludingCmo(match).map((slot) => ({
    slot,
    assignmentId: emptyCrewBlocks(match.crew[slot])[0]?.id,
  }));
}

/** Released matches that still need fee-crew officials (any open slot except CMO). */
export function matchNeedsCrewCoverage(match: Match): boolean {
  return openCrewSlotsExcludingCmo(match).length > 0;
}

const REQUESTABLE_SLOT_SET = new Set<RequestableSlot>(REQUESTABLE_SLOTS);

/** Normalize raise-hand slot prefs (supports legacy single preferredSlot). */
export function normalizeRequestableSlots(
  slots: RequestableSlot[] | undefined,
  legacy?: RequestableSlot,
): RequestableSlot[] {
  const out: RequestableSlot[] = [];
  const seen = new Set<RequestableSlot>();
  for (const slot of slots ?? []) {
    if (!REQUESTABLE_SLOT_SET.has(slot) || seen.has(slot)) continue;
    seen.add(slot);
    out.push(slot);
  }
  if (
    legacy &&
    REQUESTABLE_SLOT_SET.has(legacy) &&
    !seen.has(legacy)
  ) {
    out.push(legacy);
  }
  return out;
}

export function gameRequestPreferredSlots(req: GameRequest): RequestableSlot[] {
  return normalizeRequestableSlots(req.preferredSlots, req.preferredSlot);
}

/** First still-open preferred slot for assigner approval (fallback: first pref). */
export function resolveRaiseHandApprovalSlot(
  match: Match,
  request: GameRequest,
): RequestableSlot | undefined {
  const prefs = gameRequestPreferredSlots(request);
  if (prefs.length === 0) return undefined;
  const open = openRequestSlots(match);
  for (const slot of prefs) {
    if (open.includes(slot)) return slot;
  }
  return prefs[0];
}

/** Slots the assigner can place this official into (preferred ∩ still open). */
export function approvalSlotsForRaiseHand(
  match: Match,
  request: GameRequest,
): RequestableSlot[] {
  const prefs = gameRequestPreferredSlots(request);
  const open = new Set(openRequestSlots(match));
  return prefs.filter((s) => open.has(s));
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

/** Pending raise-hand rows for one match (coverage assign hub). */
export function pendingRaiseHandRequestsForMatch(
  requests: GameRequest[],
  matchId: string,
): GameRequest[] {
  return requests.filter(
    (r) => r.matchId === matchId && r.status === 'pending',
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
  const prefs = gameRequestPreferredSlots(request);
  if (prefs.length > 0) {
    const anyStillOpen = prefs.some((s) => !preferredSlotIsFilled(match, s));
    if (!anyStillOpen) return false;
  }
  return true;
}

/** Declined raise-hand stays on Pending until the official dismisses it. */
export function isDeclinedRequestVisible(request: GameRequest): boolean {
  return request.status === 'declined';
}

/** Raise-hand rows the official still needs to see (pending + declined). */
export function countOfficialRequestInbox(
  requests: GameRequest[],
  matches: Match[],
  userId: string,
): number {
  return requests.filter((r) => {
    if (r.userId !== userId) return false;
    const match = matches.find((m) => m.id === r.matchId);
    if (!match) return false;
    return (
      isPendingRequestActive(match, r) || isDeclinedRequestVisible(r)
    );
  }).length;
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
