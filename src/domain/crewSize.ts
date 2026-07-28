import type { Match, RequestableSlot } from './types';
import {
  REQUESTABLE_SLOTS,
  crewBlocks,
  crewPeople,
  emptyAssignment,
  emptyCmoContact,
  rolesNeededForMatch,
} from './types';

/** Always list every role type — Add role appends another empty block. */
export function availableCrewRolesToAdd(_match?: Match): RequestableSlot[] {
  return [...REQUESTABLE_SLOTS];
}

/** Append one empty capacity block for this role type. */
export function withCrewRoleAdded(
  match: Match,
  role: RequestableSlot,
): Match {
  const needed = new Set(rolesNeededForMatch(match));
  needed.add(role);

  if (role === 'cmo') {
    return {
      ...match,
      rolesNeeded: REQUESTABLE_SLOTS.filter((r) => needed.has(r)),
      cmo: [...(match.cmo ?? []), emptyCmoContact()],
    };
  }

  return {
    ...match,
    rolesNeeded: REQUESTABLE_SLOTS.filter((r) => needed.has(r)),
    crew: {
      ...match.crew,
      [role]: [...(match.crew[role] ?? []), emptyAssignment(role)],
    },
  };
}

/**
 * Remove one capacity block by id.
 * Keeps at least one MO block on the match.
 */
export function withCrewBlockRemoved(
  match: Match,
  role: RequestableSlot,
  blockId: string,
): Match {
  if (role === 'cmo') {
    const list = match.cmo ?? [];
    const next = list.filter((c) => (c.id ?? '') !== blockId);
    // Also allow remove by matching empty-without-id at index via id only.
    const needed = new Set(rolesNeededForMatch({ ...match, cmo: next }));
    if (next.length === 0) needed.delete('cmo');
    return {
      ...match,
      cmo: next.length ? next : undefined,
      rolesNeeded: REQUESTABLE_SLOTS.filter((r) => needed.has(r)),
    };
  }

  const list = match.crew[role] ?? [];
  const next = list.filter((a) => a.id !== blockId);

  if (role === 'mo' && crewBlocks(next).length === 0) {
    // Never leave the match without an MO capacity block.
    return {
      ...match,
      crew: { ...match.crew, mo: [emptyAssignment('mo')] },
    };
  }

  const crew = { ...match.crew, [role]: next };
  const needed = new Set(rolesNeededForMatch({ ...match, crew }));
  if (crewBlocks(next).length === 0) needed.delete(role);

  return {
    ...match,
    crew,
    rolesNeeded: REQUESTABLE_SLOTS.filter((r) => needed.has(r)),
  };
}

/**
 * @deprecated Prefer withCrewBlockRemoved — clears an entire role type.
 * Kept for any legacy call sites; clears all blocks of that type.
 */
export function withCrewRoleRemoved(
  match: Match,
  role: RequestableSlot,
): Match {
  if (role === 'cmo') {
    const needed = new Set(rolesNeededForMatch(match));
    needed.delete('cmo');
    if (needed.size === 0) needed.add('mo');
    return {
      ...match,
      cmo: undefined,
      rolesNeeded: REQUESTABLE_SLOTS.filter((r) => needed.has(r)),
    };
  }

  if (role === 'mo') {
    return {
      ...match,
      crew: { ...match.crew, mo: [emptyAssignment('mo')] },
    };
  }

  const crew = { ...match.crew, [role]: [] };
  const needed = new Set(rolesNeededForMatch({ ...match, crew }));
  needed.delete(role);
  return {
    ...match,
    crew,
    rolesNeeded: REQUESTABLE_SLOTS.filter((r) => needed.has(r)),
  };
}

export function roleHasAssignee(
  match: Match,
  role: RequestableSlot,
): boolean {
  if (role === 'cmo') return (match.cmo ?? []).some((c) => c.userId);
  return crewPeople(match.crew[role]).length > 0;
}

export function roleHasOpenBlock(
  match: Match,
  role: RequestableSlot,
): boolean {
  if (role === 'cmo') return (match.cmo ?? []).some((c) => !c.userId);
  return crewBlocks(match.crew[role]).some(
    (a) => a.status === 'empty' && !a.userId,
  );
}
