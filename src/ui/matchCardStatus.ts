import type { AssignmentAlertStatus } from '@/domain/assignmentAlert';
import { isComplianceHeld } from '@/domain/complianceHold';
import {
  displayMatchStatus,
  matchStatusLabel,
} from '@/domain/matchTransitions';
import { matchHasOutsideAppointmentMo } from '@/domain/placeholderAssignment';
import type { Match } from '@/domain/types';

export type MatchCardStatusPresentation = {
  tone: AssignmentAlertStatus;
  label: string;
};

/** Shared schedule-card status mapping used across persona feeds. */
export function workflowMatchCardStatus(
  match: Match,
  options: { needsReassignment?: boolean } = {},
): MatchCardStatusPresentation {
  if (isComplianceHeld(match)) {
    return { tone: 'declined', label: 'Locked' };
  }
  if (options.needsReassignment || match.status === 'needs_reassignment') {
    return { tone: 'declined', label: 'Needs reassignment' };
  }
  if (match.forfeitTeamId || match.playedForfeit) {
    return {
      tone: 'declined',
      label: match.playedForfeit ? 'Played forfeit' : 'Forfeit',
    };
  }

  const status = displayMatchStatus(match);
  if (
    status === 'cancelled' ||
    status === 'postponed' ||
    status === 'change_proposed' ||
    status === 'needs_reconfirmation'
  ) {
    return { tone: 'declined', label: matchStatusLabel(match) };
  }
  // Outside MO — no society accept / confirm work; green but informational.
  if (matchHasOutsideAppointmentMo(match)) {
    return { tone: 'approved', label: 'Outside' };
  }
  if (
    status === 'team_confirmed' ||
    status === 'crew_pending' ||
    status === 'mo_confirmed' ||
    status === 'crew_confirmed'
  ) {
    return { tone: 'approved', label: 'Confirmed' };
  }
  if (status === 'locked_confirmed') {
    return { tone: 'approved', label: matchStatusLabel(match) };
  }
  return { tone: 'pending', label: matchStatusLabel(match) };
}
