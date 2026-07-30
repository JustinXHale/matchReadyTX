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

/** 1 = Poor … 5 = Excellent */
export type CoachFeedbackScaleValue = 1 | 2 | 3 | 4 | 5;

export const COACH_FEEDBACK_SCALE_VALUES: CoachFeedbackScaleValue[] = [
  1, 2, 3, 4, 5,
];

export const COACH_FEEDBACK_SCALE_LABELS: Record<
  CoachFeedbackScaleValue,
  string
> = {
  1: 'Poor',
  2: 'Below Average',
  3: 'Average',
  4: 'Above Average',
  5: 'Excellent',
};

/** Short labels for compact radio UIs. */
export const COACH_FEEDBACK_SCALE_SHORT: Record<
  CoachFeedbackScaleValue,
  string
> = {
  1: '1',
  2: '2',
  3: '3',
  4: '4',
  5: '5',
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
  lineout: 'Lineout / touch / maul',
  safety: 'Safety / foul play',
  communication: 'Communication',
  professionalism: 'Professionalism',
  overall: 'Overall',
};

/** What each rating covers (Advantage-style competency summary). */
export const COACH_FEEDBACK_CRITERION_HINTS: Record<
  CoachFeedbackScaleKey,
  string
> = {
  breakdown:
    'Tackler and assist release/gate; tackled player plays the ball; arriving players through the gate, on feet, no sealing; quick ball.',
  scrum:
    'Set-up and engagement; fair contest (square, steady, credible feed); process management and “use it”; quality of ball out.',
  lineout:
    'Touch and mark of touch; lineout set-up (gap, numbers, throw); maul formation and defense; positioning and prevention.',
  safety:
    'Dangerous play, obstruction, unfair play, and repeated infringement — spots issues and applies clear standards.',
  communication:
    'Clear calls so teams understand and trust the process; voice, signals, and body language; keeps managing while communicating.',
  professionalism:
    'Calm under pressure; accurate high-impact decisions; rapport and influence; equal, uniform standards for both sides.',
  overall: 'Overall performance across the match.',
};

export const COACH_FEEDBACK_SCALE_LEGEND =
  '1 Poor · 2 Below Average · 3 Average · 4 Above Average · 5 Excellent — rate how the Match Official performed at this level.';

export type CoachFeedbackCommentKey =
  | 'commentsOnScores'
  | 'areasDoneWell'
  | 'areasToImprove'
  | 'otherFeedback'
  | 'otherCrewFeedback'
  | 'videoNotes';

export const COACH_FEEDBACK_COMMENT_BLOCKS: {
  key: CoachFeedbackCommentKey;
  label: string;
}[] = [
  {
    key: 'commentsOnScores',
    label:
      'Is there any feedback you would like to leave as to why you left these scores?',
  },
  {
    key: 'areasDoneWell',
    label: 'Were there areas of the game refereed well that you want to note?',
  },
  {
    key: 'areasToImprove',
    label: 'Are there areas for improvement you want to call out?',
  },
  {
    key: 'otherFeedback',
    label: 'Is there any other relevant feedback?',
  },
  {
    key: 'otherCrewFeedback',
    label: 'Do you have feedback on other crew (AR, No.4)?',
  },
  {
    key: 'videoNotes',
    label: 'Do you want to add notes about the video (timestamps)?',
  },
];

export type CoachFeedbackStatus = 'draft' | 'submitted' | 'declined';

export type CoachFeedbackEditAction = 'save' | 'submit' | 'decline';

export interface CoachFeedbackEdit {
  at: string;
  byUserId: string;
  byName: string;
  action: CoachFeedbackEditAction;
}

export interface CoachFeedback {
  id: string;
  orgId: string;
  /** Always MO in v1. */
  slot: 'mo';
  matchId: string;
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
  /** Partial allowed for draft/declined; complete required to submit. */
  scales: Partial<Record<CoachFeedbackScaleKey, CoachFeedbackScaleValue>>;
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
  /** Coach is open to Scheduler follow-up about this report. */
  contactAboutReport?: boolean;
  reportingTeamId: string;
  reportingTeamName: string;
  status: CoachFeedbackStatus;
  /** First time submitted to the Scheduler (unchanged on later edits). */
  submittedAt?: string;
  edits: CoachFeedbackEdit[];
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
 * Home and away sides each get their own feedback doc.
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

/** Card still needs attention (lit/warn) until submitted or declined. */
export function coachFeedbackNeedsAttention(
  existing: CoachFeedback | undefined,
): boolean {
  if (!existing) return true;
  return existing.status === 'draft';
}

export function scalesNeedComments(
  scales: Partial<Record<CoachFeedbackScaleKey, CoachFeedbackScaleValue>>,
): boolean {
  return COACH_FEEDBACK_SCALE_KEYS.some((k) => {
    const v = scales[k];
    return v === 1 || v === 2;
  });
}

export function validateCoachFeedbackScales(
  scales: Partial<Record<CoachFeedbackScaleKey, CoachFeedbackScaleValue>>,
): scales is Record<CoachFeedbackScaleKey, CoachFeedbackScaleValue> {
  return COACH_FEEDBACK_SCALE_KEYS.every((k) => {
    const v = scales[k];
    return (
      typeof v === 'number' &&
      COACH_FEEDBACK_SCALE_VALUES.includes(v as CoachFeedbackScaleValue)
    );
  });
}

/** Mean of rated criteria (1–5). Null when nothing rated. */
export function coachFeedbackAverage(
  scales: Partial<Record<CoachFeedbackScaleKey, CoachFeedbackScaleValue>>,
): number | null {
  const values = COACH_FEEDBACK_SCALE_KEYS.map((k) => scales[k]).filter(
    (v): v is CoachFeedbackScaleValue => typeof v === 'number',
  );
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Nearest scale label for a numeric average. */
export function coachFeedbackAverageLabel(
  avg: number,
): CoachFeedbackScaleValue {
  const rounded = Math.round(avg) as CoachFeedbackScaleValue;
  if (rounded < 1) return 1;
  if (rounded > 5) return 5;
  return rounded;
}

export function appendCoachFeedbackEdit(
  existing: CoachFeedbackEdit[] | undefined,
  edit: CoachFeedbackEdit,
): CoachFeedbackEdit[] {
  return [...(existing ?? []), edit];
}

/** Map legacy string scale values from early drafts to 1–5. */
export function normalizeScaleValue(
  raw: unknown,
): CoachFeedbackScaleValue | null {
  if (typeof raw === 'number' && COACH_FEEDBACK_SCALE_VALUES.includes(raw as CoachFeedbackScaleValue)) {
    return raw as CoachFeedbackScaleValue;
  }
  if (typeof raw === 'string') {
    const asNum = Number(raw);
    if (
      Number.isInteger(asNum) &&
      COACH_FEEDBACK_SCALE_VALUES.includes(asNum as CoachFeedbackScaleValue)
    ) {
      return asNum as CoachFeedbackScaleValue;
    }
    const legacy: Record<string, CoachFeedbackScaleValue> = {
      poor: 1,
      below_average: 2,
      average: 3,
      above_average: 4,
      excellent: 5,
    };
    return legacy[raw] ?? null;
  }
  return null;
}
