import {
  assignmentForUser,
  crewBlocks,
  crewPeople,
  rolesNeededForMatch,
  type CrewAssignment,
  type CrewSlot,
  type Match,
} from '@/domain/types';

/** Fixed display order for appointment crew column. */
export const APPOINTMENT_CREW_ORDER = [
  'mo',
  'ar1',
  'ar2',
  'no4',
  'cmo',
] as const;

export type AppointmentCrewKey = (typeof APPOINTMENT_CREW_ORDER)[number];

/**
 * Display for crew lines on appointment cards:
 * - confirmed → official name
 * - assigned but not accepted → Pending
 * - empty / declined / released → None
 */
export function crewSlotLineLabel(assignment: CrewAssignment | undefined): string {
  if (
    !assignment ||
    !assignment.userId ||
    assignment.status === 'empty' ||
    assignment.status === 'declined' ||
    assignment.status === 'released'
  ) {
    return 'None';
  }
  if (assignment.status === 'confirmed') {
    return assignment.userName ?? 'Appointed';
  }
  // pending_internal | official | held — named but not yet accepted
  return 'Pending';
}

export function appointmentMySlot(
  match: Match,
  userId: string,
): CrewSlot | null {
  const found = assignmentForUser(match, userId);
  if (!found || found.slot === 'cmo') return null;
  return found.slot;
}

/** Assigned to this user but they have not accepted yet. */
export function isAppointmentPendingAccept(
  match: Match,
  userId: string,
): boolean {
  const found = assignmentForUser(match, userId);
  if (!found?.assignment) return false;
  const status = found.assignment.status;
  return (
    status === 'official' ||
    status === 'pending_internal' ||
    status === 'held'
  );
}

/** Count of appointments waiting on this official to accept. */
export function countPendingAppointments(
  matches: Match[],
  userId: string,
): number {
  return matches.filter((m) => isAppointmentPendingAccept(m, userId)).length;
}

export function crewKeyShortLabel(key: AppointmentCrewKey): string {
  if (key === 'mo') return 'MO';
  if (key === 'ar1') return 'AR1';
  if (key === 'ar2') return 'AR2';
  if (key === 'no4') return 'No.4';
  return 'CMO';
}

export function crewRoleLineLabel(list: CrewAssignment[] | undefined): string {
  const labels = (list ?? [])
    .map((a) => crewSlotLineLabel(a))
    .filter((l) => l !== 'None');
  return labels.length > 0 ? labels.join(', ') : 'None';
}

export function crewValueForKey(
  match: Match,
  key: AppointmentCrewKey,
): string {
  if (key === 'cmo') {
    const names = (match.cmo ?? [])
      .map((c) => c.userName?.trim())
      .filter(Boolean);
    return names.length > 0 ? names.join(', ') : 'None';
  }
  return crewRoleLineLabel(match.crew[key]);
}

export type CrewColumnLine = {
  id: string;
  slotLabel: string;
  value: string;
  isMine: boolean;
};

/**
 * Event-card crew column: named people each get a line; remaining capacity
 * collapses to `(n) MO Open` so 3 MO spots are not shown as a single MO.
 */
export function crewColumnLines(
  match: Match,
  opts?: { highlightUserId?: string; redactNames?: boolean },
): CrewColumnLine[] {
  const highlightUserId = opts?.highlightUserId;
  const redactNames = Boolean(opts?.redactNames);
  const needed = new Set(rolesNeededForMatch(match));
  const lines: CrewColumnLine[] = [];

  const pushOpen = (id: string, label: string, count: number) => {
    if (count <= 0) return;
    lines.push({
      id,
      slotLabel: count > 1 ? `(${count}) ${label}` : label,
      value: 'Open',
      isMine: false,
    });
  };

  for (const key of APPOINTMENT_CREW_ORDER) {
    if (key === 'cmo') {
      if (!needed.has('cmo')) continue;
      const list = match.cmo ?? [];
      const named = list.filter((c) => Boolean(c.userId));
      const openN = list.filter((c) => !c.userId).length;
      for (const c of named) {
        const isMine = Boolean(highlightUserId && c.userId === highlightUserId);
        lines.push({
          id: `cmo-${c.id ?? c.userId ?? 'named'}`,
          slotLabel: 'CMO',
          value: redactNames
            ? 'Assigned'
            : (c.userName?.trim() || 'Assigned'),
          isMine,
        });
      }
      if (openN > 0) pushOpen('cmo-open', 'CMO', openN);
      else if (named.length === 0) pushOpen('cmo-open', 'CMO', 1);
      continue;
    }

    if (!needed.has(key)) continue;
    const label = crewKeyShortLabel(key);
    const blocks = crewBlocks(match.crew[key]);
    const people = blocks.filter((a) => Boolean(a.userId));
    const openN = blocks.filter(
      (a) => !a.userId && a.status === 'empty',
    ).length;

    for (const a of people) {
      const isMine = Boolean(highlightUserId && a.userId === highlightUserId);
      const raw = crewSlotLineLabel(a);
      const value = redactNames
        ? a.status === 'confirmed'
          ? 'Confirmed'
          : 'Pending'
        : raw;
      lines.push({
        id: a.id,
        slotLabel: label,
        value,
        isMine,
      });
    }
    if (openN > 0) pushOpen(`${key}-open`, label, openN);
    else if (people.length === 0) pushOpen(`${key}-open`, label, 1);
  }

  return lines;
}

/** Display name(s) for Match Official on this match. */
export function moDisplayNames(match: Match): string {
  return (
    crewPeople(match.crew.mo)
      .map((a) => a.userName)
      .filter(Boolean)
      .join(', ') || 'Match Official'
  );
}
