import type { CrewAssignment, CrewSlot, Match } from '@/domain/types';
import { crewPeople, rolesNeededForMatch } from '@/domain/types';

export type CrewChipTone = 'ok' | 'warn' | 'urgent';

/** Green = all confirmed, yellow = some assigned pending, red = open. */
export function crewAssignmentChipTone(
  assignment: CrewAssignment | undefined,
): CrewChipTone {
  if (
    !assignment ||
    !assignment.userId ||
    assignment.status === 'empty' ||
    assignment.status === 'declined' ||
    assignment.status === 'released'
  ) {
    return 'urgent';
  }
  if (assignment.status === 'confirmed') return 'ok';
  return 'warn';
}

export function crewRoleChipTone(list: CrewAssignment[] | undefined): CrewChipTone {
  const people = crewPeople(list);
  if (people.length === 0) return 'urgent';
  if (people.every((a) => a.status === 'confirmed')) return 'ok';
  return 'warn';
}

export function crewChipClass(tone: CrewChipTone): string {
  if (tone === 'ok') return 'rs-pill rs-pill--ok';
  if (tone === 'warn') return 'rs-pill rs-pill--warn';
  return 'rs-pill rs-pill--urgent';
}

const CREW_CHIP_ROLES: { slot: CrewSlot; label: string }[] = [
  { slot: 'mo', label: 'Official' },
  { slot: 'ar1', label: 'AR1' },
  { slot: 'ar2', label: 'AR2' },
];

/** Official / AR1 / AR2 chips for match header (respects rolesNeeded). */
export function crewStatusChipsForMatch(
  match: Match,
): { slot: CrewSlot; label: string; tone: CrewChipTone }[] {
  const needed = new Set(rolesNeededForMatch(match));
  return CREW_CHIP_ROLES.filter((r) => needed.has(r.slot)).map((r) => ({
    ...r,
    tone: crewRoleChipTone(match.crew[r.slot]),
  }));
}

export function shouldShowCrewStatusChips(match: Match): boolean {
  return (
    match.status === 'crew_pending' ||
    match.status === 'mo_confirmed' ||
    match.status === 'crew_confirmed' ||
    match.status === 'needs_reassignment' ||
    match.status === 't72_officials_pending' ||
    match.status === 'team_confirmed' ||
    match.status === 'needs_reconfirmation'
  );
}
