import type {
  CrewAssignment,
  CrewSlot,
  HistoryEntry,
  Match,
  UserProfile,
} from './types';
import {
  CREW_SLOTS,
  crewPeople,
  emptyCrewBlocks,
  isCrewVisibleToTeams,
  newAssignmentId,
} from './types';

function historyId(): string {
  return `h_${Math.random().toString(36).slice(2, 10)}`;
}

export function appendHistory(
  assignment: CrewAssignment,
  entry: Omit<HistoryEntry, 'id'>,
): CrewAssignment {
  return {
    ...assignment,
    history: [...assignment.history, { ...entry, id: historyId() }],
  };
}

/**
 * Fill first empty stub for the role, or append.
 * Rejects duplicate userId on the same role.
 */
export function assignOfficial(
  match: Match,
  slot: CrewSlot,
  user: Pick<UserProfile, 'uid' | 'displayName'>,
  opts?: { viaRequest?: boolean; internal?: boolean; assignmentId?: string },
): Match {
  const existing = match.crew[slot] ?? [];
  if (existing.some((a) => a.userId === user.uid)) {
    return match;
  }
  const bothConfirmed = Boolean(match.homeConfirmedAt && match.awayConfirmedAt);
  const status =
    opts?.internal || !bothConfirmed ? 'pending_internal' : 'official';
  const action = opts?.viaRequest ? 'assigned_via_request' : 'assigned';

  const fillId =
    opts?.assignmentId ??
    emptyCrewBlocks(existing)[0]?.id ??
    null;

  let assignment: CrewAssignment = {
    id: fillId ?? newAssignmentId(),
    slot,
    userId: user.uid,
    userName: user.displayName,
    status,
    history: fillId
      ? (existing.find((a) => a.id === fillId)?.history ?? [])
      : [],
  };
  assignment = appendHistory(assignment, {
    at: new Date().toISOString(),
    userId: user.uid,
    userName: user.displayName,
    action,
  });

  let nextList: CrewAssignment[];
  if (fillId && existing.some((a) => a.id === fillId)) {
    nextList = existing.map((a) => (a.id === fillId ? assignment : a));
  } else {
    nextList = [...existing, assignment];
  }

  const crew = { ...match.crew, [slot]: nextList };
  let matchStatus = match.status;
  if (bothConfirmed && status === 'official') {
    matchStatus = 'crew_pending';
  }
  return { ...match, crew, status: matchStatus };
}

export function confirmOfficialSlot(
  match: Match,
  slot: CrewSlot,
  assignmentId?: string,
): Match {
  const list = match.crew[slot] ?? [];
  const target =
    (assignmentId
      ? list.find((a) => a.id === assignmentId)
      : list.find((a) => a.userId)) ?? null;
  if (!target?.userId) return match;

  const nextList = list.map((a) => {
    if (a.id !== target.id) return a;
    return appendHistory(
      {
        ...a,
        status: 'confirmed',
        confirmedAt: new Date().toISOString(),
      },
      {
        at: new Date().toISOString(),
        userId: a.userId!,
        userName: a.userName ?? '',
        action: 'confirmed',
      },
    );
  });
  const crew = { ...match.crew, [slot]: nextList };
  let status = match.status;
  if (slot === 'mo') {
    status = 'mo_confirmed';
  }
  const allFilledConfirmed = CREW_SLOTS.every((s) =>
    crewPeople(crew[s]).every((a) => a.status === 'confirmed'),
  );
  if (allFilledConfirmed && isCrewVisibleToTeams({ ...match, crew })) {
    status = 'crew_confirmed';
  }
  return { ...match, crew, status };
}

/**
 * Official marks unavailable — clear the person but keep the open block
 * (empty stub) so tournament capacity remains.
 */
export function markUnavailableAndRelease(
  match: Match,
  slot: CrewSlot,
  reason: string,
  action:
    | 'unavailable_on_change'
    | 'declined'
    | 't72_no'
    | 'released' = 'declined',
  assignmentId?: string,
): Match {
  const list = match.crew[slot] ?? [];
  const target =
    (assignmentId
      ? list.find((a) => a.id === assignmentId)
      : list.find((a) => a.userId)) ?? null;
  if (!target?.userId) return match;

  const emptied = appendHistory(
    {
      ...target,
      userId: undefined,
      userName: undefined,
      status: 'empty',
      confirmedAt: undefined,
    },
    {
      at: new Date().toISOString(),
      userId: target.userId,
      userName: target.userName ?? '',
      action,
      reason,
    },
  );
  const nextList = list.map((a) => (a.id === target.id ? emptied : a));
  const crew = { ...match.crew, [slot]: nextList };
  const moPeople = crewPeople(crew.mo);
  return {
    ...match,
    crew,
    status: moPeople.length === 0 ? 'needs_reassignment' : match.status,
  };
}

/** Slots that still need at least one official to accept / reconfirm. */
export function namedOfficialsNeedingAvailability(match: Match): CrewSlot[] {
  return CREW_SLOTS.filter((s) =>
    crewPeople(match.crew[s]).some(
      (c) =>
        c.status === 'pending_internal' ||
        c.status === 'official' ||
        c.status === 'held',
    ),
  );
}

/** Flat list of active assignments for history / UI rows. */
export function allActiveAssignments(
  match: Match,
): { slot: CrewSlot; assignment: CrewAssignment }[] {
  const out: { slot: CrewSlot; assignment: CrewAssignment }[] = [];
  for (const slot of CREW_SLOTS) {
    for (const assignment of crewPeople(match.crew[slot])) {
      out.push({ slot, assignment });
    }
  }
  return out;
}
