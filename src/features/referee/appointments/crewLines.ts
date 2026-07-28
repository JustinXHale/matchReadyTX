import {
  assignmentForUser,
  crewPeople,
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

/** Display name(s) for Match Official on this match. */
export function moDisplayNames(match: Match): string {
  return (
    crewPeople(match.crew.mo)
      .map((a) => a.userName)
      .filter(Boolean)
      .join(', ') || 'Match Official'
  );
}
