/**
 * Team Admin (coach/captain) feedback on Match Officials.
 * Scheduler-confidential — officials never read these documents.
 */

import { isKickoffUpcoming } from '@/domain/requests';
import {
  crewPeople,
  isCrewVisibleToTeams,
  type Match,
  type UserProfile,
} from '@/domain/types';

export type CoachFeedbackScaleValue =
  | 'excellent'
  | 'above_average'
  | 'average'
  | 'below_average'
  | 'poor';

export const COACH_FEEDBACK_SCALE_VALUES: CoachFeedbackScaleValue[] = [
  'excellent',
  'above_average',
  'average',
  'below_average',
  'poor',
];

export const COACH_FEEDBACK_SCALE_LABELS: Record<
  CoachFeedbackScaleValue,
  string
> = {
  excellent: 'Excellent',
  above_average: 'Above Average',
  average: 'Average',
  below_average: 'Below Average',
  poor: 'Poor',
};

export type CoachFeedbackScaleKey =
  | 'breakdown'
  | 'scrum'
  | 'lineout'
  | 'safety'
  | 'communication'
  | 'professionalism'
  | 'overall';

export const COACH_FEEDBACK_SCALE_KEYS: CoachFeedbackScaleKey[] = [
  'breakdown',
  'scrum',
  'lineout',
  'safety',
  'communication',
  'professionalism',
  'overall',
];

export const COACH_FEEDBACK_CRITERION_LABELS: Record<
  CoachFeedbackScaleKey,
  string
> = {
  breakdown: 'Breakdown',
  scrum: 'Scrum',
  lineout: 'Lineout',
  safety: 'Safety',
  communication: 'Communication',
  professionalism: 'Professionalism',
  overall: 'Overall',
};

export const COACH_FEEDBACK_SCALE_LEGEND =
  'Excellent: well above grade · Above Average: very good / above grade · Average: good / at grade · Below Average: needs work / below grade · Poor: unprepared for this level';

export interface CoachFeedback {
  id: string;
  orgId: string;
  matchId: string;
  /** Always MO in v1. */
  slot: 'mo';
  officialUserId: string;
  officialName: string;
  homeTeamId: string;
  homeTeamName: string;
  awayTeamId: string;
  awayTeamName: string;
  kickoffAt: string;
  competition?: string;
  level: string;
  /** Display string, e.g. "28–17". */
  score: string;
  scales: Record<CoachFeedbackScaleKey, CoachFeedbackScaleValue>;
  commentsOnScores?: string;
  areasDoneWell?: string;
  areasToImprove?: string;
  otherFeedback?: string;
  videoLink?: string;
  videoNotes?: string;
  /** Optional notes about AR / No.4 / other crew (not a full rating matrix). */
  otherCrewFeedback?: string;
  submitterUserId: string;
  submitterName: string;
  submitterEmail: string;
  submitterPhone?: string;
  /** Head Coach, Captain, President, etc. */
  clubRole: string;
  reportingTeamId: string;
  reportingTeamName: string;
  status: 'submitted';
  createdAt: string;
  updatedAt: string;
}

/** Deterministic id — enforces one submission per (match, reporting team). */
export function coachFeedbackDocId(
  matchId: string,
  reportingTeamId: string,
): string {
  return `${matchId}_${reportingTeamId}`;
}

export function formatMatchScore(match: Match): string {
  if (
    typeof match.homeScore === 'number' &&
    typeof match.awayScore === 'number'
  ) {
    return `${match.homeScore}–${match.awayScore}`;
  }
  return '';
}

/** First confirmed (or assigned) MO on the match. */
export function matchOfficialForFeedback(
  match: Match,
): { userId: string; userName: string } | null {
  const people = crewPeople(match.crew.mo);
  const confirmed = people.find(
    (a) => a.status === 'confirmed' && a.userId && a.userName,
  );
  if (confirmed?.userId && confirmed.userName) {
    return { userId: confirmed.userId, userName: confirmed.userName };
  }
  const any = people.find((a) => a.userId && a.userName);
  if (any?.userId && any.userName) {
    return { userId: any.userId, userName: any.userName };
  }
  return null;
}

export function reportingTeamIdForUser(
  match: Match,
  user: UserProfile,
): string | null {
  const home = user.teamIds.includes(match.homeTeamId);
  const away = user.teamIds.includes(match.awayTeamId);
  if (home && !away) return match.homeTeamId;
  if (away && !home) return match.awayTeamId;
  if (home) return match.homeTeamId;
  if (away) return match.awayTeamId;
  return null;
}

/**
 * Past matches where this team admin may leave MO feedback.
 * Requires crew visible to teams and an assigned MO.
 */
export function isMatchEligibleForCoachFeedback(
  match: Match,
  user: UserProfile,
  nowMs = Date.now(),
): boolean {
  if (!user.roles.includes('teamAdmin')) return false;
  if (match.status === 'cancelled' || match.status === 'draft') return false;
  if (isKickoffUpcoming(match, nowMs)) return false;
  if (!isCrewVisibleToTeams(match)) return false;
  if (!matchOfficialForFeedback(match)) return false;
  return reportingTeamIdForUser(match, user) != null;
}

export function existingCoachFeedback(
  feedback: CoachFeedback[],
  matchId: string,
  reportingTeamId: string,
): CoachFeedback | undefined {
  return feedback.find(
    (f) => f.matchId === matchId && f.reportingTeamId === reportingTeamId,
  );
}

export function scalesNeedComments(
  scales: Partial<Record<CoachFeedbackScaleKey, CoachFeedbackScaleValue>>,
): boolean {
  return COACH_FEEDBACK_SCALE_KEYS.some((k) => {
    const v = scales[k];
    return v === 'below_average' || v === 'poor';
  });
}

export function validateCoachFeedbackScales(
  scales: Partial<Record<CoachFeedbackScaleKey, CoachFeedbackScaleValue>>,
): scales is Record<CoachFeedbackScaleKey, CoachFeedbackScaleValue> {
  return COACH_FEEDBACK_SCALE_KEYS.every((k) => {
    const v = scales[k];
    return (
      v != null && COACH_FEEDBACK_SCALE_VALUES.includes(v as CoachFeedbackScaleValue)
    );
  });
}
