import { formatMatchKickoffDate, formatMatchKickoffTime, orgTimeZone } from '@/domain/matchTime';
import type { CrewAssignment, CrewSlot, Match } from '@/domain/types';

export type AssignmentEmailEvent = 'assignment' | 'assignment_resend';

/** Stamp crew row after a successful assignment email send. */
export function markAssignmentEmailSent(
  match: Match,
  slot: CrewSlot,
  userId: string,
  event: AssignmentEmailEvent,
  at = new Date().toISOString(),
): Match {
  const crew = { ...match.crew };
  crew[slot] = (crew[slot] ?? []).map((a) =>
    a.userId === userId
      ? {
          ...a,
          assignmentNotifiedAt: at,
          assignmentNotifyEvent: event,
        }
      : a,
  );
  return { ...match, crew };
}

/** e.g. Notified: Sep 17, 2026 at 10:15 AM */
export function assignmentEmailNotifyLine(
  assignment: Pick<CrewAssignment, 'assignmentNotifiedAt' | 'assignmentNotifyEvent'>,
  timeZone?: string | null,
): string | null {
  const at = assignment.assignmentNotifiedAt;
  if (!at) return null;
  const tz = orgTimeZone(timeZone);
  const date = formatMatchKickoffDate(at, tz, { year: 'numeric' });
  const time = formatMatchKickoffTime(at, tz);
  const prefix =
    assignment.assignmentNotifyEvent === 'assignment_resend'
      ? 'Re-notified'
      : 'Notified';
  return time ? `${prefix}: ${date} at ${time}` : `${prefix}: ${date}`;
}
