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
import {
  FIVE_POINT_LABELS,
  FIVE_POINT_VALUES,
  SCALE_NA,
  SCALE_NA_LABEL,
  isFivePointValue,
  parseFivePointChoice,
  type FivePointChoice,
  type FivePointValue,
} from '@/domain/fivePointScale';

/** 1 = Poor … 5 = Excellent, or N/A. */
export type CoachFeedbackScaleValue = FivePointChoice;

export const COACH_FEEDBACK_SCALE_VALUES: FivePointValue[] = [
  ...FIVE_POINT_VALUES,
];

export const COACH_FEEDBACK_SCALE_LABELS: Record<
  CoachFeedbackScaleValue,
  string
> = {
  ...FIVE_POINT_LABELS,
  [SCALE_NA]: SCALE_NA_LABEL,
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
  [SCALE_NA]: 'N/A',
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
  '1 Poor · 2 Below Average · 3 Average · 4 Above Average · 5 Excellent · N/A not applicable — rate how the Match Official performed at this level, or N/A if it does not apply.';

export const COACH_FEEDBACK_CREW_SCALE_LEGEND =
  '1 Poor · 2 Below Average · 3 Average · 4 Above Average · 5 Excellent · N/A not applicable — rate how the referee crew performed for this tournament, or N/A if it does not apply.';

export type CoachFeedbackScope = 'official' | 'crew';

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
  feedbackScope: CoachFeedbackScope;
  /** Anchor match row for display and validation. */
  matchId: string;
  slot: 'mo' | 'crew';
  officialUserId?: string;
  officialName?: string;
  /** Normalized title slug — doc id for crew-scoped feedback. */
  tournamentGroupKey?: string;
  /** Event title snapshot for crew feedback display. */
  tournamentTitle?: string;
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
  /**
   * Scheduler published this report on the official’s public profile.
   * Default (missing/false) is hidden from everyone except Scheduler, Insights, and the filing club.
   */
  publicOnProfile?: boolean;
  edits: CoachFeedbackEdit[];
  createdAt: string;
  updatedAt: string;
}

/** Deterministic id — one submission per (match or tournament group, reporting team). */
export function tournamentGroupKeyFromMatch(match: Match): string {
  const title = match.title?.trim();
  if (!title) return match.id;
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96);
  return slug || match.id;
}

export function coachFeedbackScopeForMatch(match: Match): CoachFeedbackScope {
  return match.isTournament ? 'crew' : 'official';
}

export function isCrewScopeCoachFeedback(feedback: CoachFeedback): boolean {
  return feedback.feedbackScope === 'crew';
}

export function coachFeedbackDocId(
  match: Match,
  reportingTeamId: string,
): string {
  if (match.isTournament) {
    return `${tournamentGroupKeyFromMatch(match)}_${reportingTeamId}`;
  }
  return `${match.id}_${reportingTeamId}`;
}

export function coachFeedbackScaleLegend(scope: CoachFeedbackScope): string {
  return scope === 'crew'
    ? COACH_FEEDBACK_CREW_SCALE_LEGEND
    : COACH_FEEDBACK_SCALE_LEGEND;
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

function matchHasAssignedCrew(match: Match): boolean {
  for (const slot of ['mo', 'ar1', 'ar2', 'no4'] as const) {
    if (crewPeople(match.crew[slot]).some((a) => a.userId)) return true;
  }
  return false;
}

/**
 * Past matches where this team admin may leave feedback.
 * League: home or away, one MO report each.
 * Tournament: host (home) only — crew-scoped, grouped by title.
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
  const reportingTeamId = reportingTeamIdForUser(match, user);
  if (!reportingTeamId) return false;
  if (match.isTournament) {
    return reportingTeamId === match.homeTeamId && matchHasAssignedCrew(match);
  }
  return matchOfficialForFeedback(match) != null;
}

/** Pick the anchor match for a tournament group (latest kickoff). */
export function anchorMatchForTournamentGroup(
  matches: Match[],
  groupKey: string,
): Match | undefined {
  const group = matches.filter(
    (m) => m.isTournament && tournamentGroupKeyFromMatch(m) === groupKey,
  );
  if (group.length === 0) return undefined;
  return [...group].sort(
    (a, b) => new Date(b.kickoffAt).getTime() - new Date(a.kickoffAt).getTime(),
  )[0];
}

export function existingCoachFeedback(
  feedback: CoachFeedback[],
  match: Match,
  reportingTeamId: string,
): CoachFeedback | undefined {
  const id = coachFeedbackDocId(match, reportingTeamId);
  return feedback.find((f) => f.id === id);
}

export type CoachFeedbackListRow =
  | {
      kind: 'official';
      match: Match;
      reportingTeamId: string;
      existing?: CoachFeedback;
      mo: { userId: string; userName: string };
    }
  | {
      kind: 'crew';
      match: Match;
      reportingTeamId: string;
      existing?: CoachFeedback;
      tournamentTitle: string;
    };

/** Rows for Team Admin feedback list — one row per league match or tournament group. */
export function coachFeedbackListRows(
  matches: Match[],
  user: UserProfile,
  feedback: CoachFeedback[],
  nowMs = Date.now(),
): CoachFeedbackListRow[] {
  const eligible = matches.filter((m) =>
    isMatchEligibleForCoachFeedback(m, user, nowMs),
  );
  const rows: CoachFeedbackListRow[] = [];
  const tournamentGroups = new Map<string, Match[]>();

  for (const match of eligible) {
    const reportingTeamId = reportingTeamIdForUser(match, user)!;
    if (match.isTournament) {
      const key = tournamentGroupKeyFromMatch(match);
      const list = tournamentGroups.get(key) ?? [];
      list.push(match);
      tournamentGroups.set(key, list);
      continue;
    }
    const mo = matchOfficialForFeedback(match);
    if (!mo) continue;
    rows.push({
      kind: 'official',
      match,
      reportingTeamId,
      existing: existingCoachFeedback(feedback, match, reportingTeamId),
      mo,
    });
  }

  for (const [, groupMatches] of tournamentGroups) {
    const anchor = [...groupMatches].sort(
      (a, b) =>
        new Date(b.kickoffAt).getTime() - new Date(a.kickoffAt).getTime(),
    )[0]!;
    const reportingTeamId = reportingTeamIdForUser(anchor, user)!;
    rows.push({
      kind: 'crew',
      match: anchor,
      reportingTeamId,
      existing: existingCoachFeedback(feedback, anchor, reportingTeamId),
      tournamentTitle: anchor.title?.trim() || 'Tournament',
    });
  }

  return rows.sort((a, b) =>
    new Date(a.match.kickoffAt).getTime() -
    new Date(b.match.kickoffAt).getTime(),
  );
}

export function buildCoachFeedback(input: {
  match: Match;
  reportingTeamId: string;
  reportingTeamName: string;
  orgId: string;
  user: UserProfile;
  status: CoachFeedbackStatus;
  action: CoachFeedbackEditAction;
  existing?: CoachFeedback;
  scales: Partial<Record<CoachFeedbackScaleKey, CoachFeedbackScaleValue>>;
  commentsOnScores?: string;
  areasDoneWell?: string;
  areasToImprove?: string;
  otherFeedback?: string;
  otherCrewFeedback?: string;
  videoLink?: string;
  videoNotes?: string;
  clubRole: string;
  submitterPhone?: string;
  contactAboutReport?: boolean;
}): CoachFeedback {
  const { match, reportingTeamId, reportingTeamName, user, status, action } =
    input;
  const scope = coachFeedbackScopeForMatch(match);
  const now = new Date().toISOString();
  const edit = {
    at: now,
    byUserId: user.uid,
    byName: user.displayName,
    action,
  };
  const mo =
    scope === 'official' ? matchOfficialForFeedback(match) : null;
  if (scope === 'official' && !mo) {
    throw new Error('Match Official required for league feedback.');
  }

  return {
    id: coachFeedbackDocId(match, reportingTeamId),
    orgId: input.orgId,
    feedbackScope: scope,
    matchId: match.id,
    slot: scope === 'crew' ? 'crew' : 'mo',
    officialUserId: mo?.userId,
    officialName: mo?.userName,
    tournamentGroupKey:
      scope === 'crew' ? tournamentGroupKeyFromMatch(match) : undefined,
    tournamentTitle:
      scope === 'crew' ? match.title?.trim() || 'Tournament' : undefined,
    homeTeamId: match.homeTeamId,
    homeTeamName: match.homeTeamName,
    awayTeamId: match.awayTeamId,
    awayTeamName: match.awayTeamName,
    kickoffAt: match.kickoffAt,
    competition: match.competition,
    level: match.level,
    score: scope === 'crew' ? '' : formatMatchScore(match),
    scales: input.scales,
    commentsOnScores: input.commentsOnScores,
    areasDoneWell: input.areasDoneWell,
    areasToImprove: input.areasToImprove,
    otherFeedback: input.otherFeedback,
    otherCrewFeedback: input.otherCrewFeedback,
    videoLink: input.videoLink,
    videoNotes: input.videoNotes,
    submitterUserId: user.uid,
    submitterName: user.displayName,
    submitterEmail: user.email,
    submitterPhone: input.submitterPhone,
    clubRole: input.clubRole.trim(),
    contactAboutReport: input.contactAboutReport === true,
    reportingTeamId,
    reportingTeamName,
    status,
    submittedAt:
      status === 'submitted'
        ? (input.existing?.submittedAt ?? now)
        : input.existing?.submittedAt,
    publicOnProfile:
      scope === 'crew' ? false : input.existing?.publicOnProfile,
    edits: appendCoachFeedbackEdit(input.existing?.edits, edit),
    createdAt: input.existing?.createdAt ?? now,
    updatedAt: now,
  };
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
    return v === SCALE_NA || isFivePointValue(v);
  });
}

/** Mean of numeric ratings (1–5). N/A is skipped. Null when nothing rated. */
export function coachFeedbackAverage(
  scales: Partial<Record<CoachFeedbackScaleKey, CoachFeedbackScaleValue>>,
): number | null {
  const values = COACH_FEEDBACK_SCALE_KEYS.map((k) => scales[k]).filter(
    (v): v is FivePointValue => isFivePointValue(v),
  );
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Nearest scale label for a numeric average. */
export function coachFeedbackAverageLabel(avg: number): FivePointValue {
  const rounded = Math.round(avg);
  if (rounded < 1) return 1;
  if (rounded > 5) return 5;
  return rounded as FivePointValue;
}

export function appendCoachFeedbackEdit(
  existing: CoachFeedbackEdit[] | undefined,
  edit: CoachFeedbackEdit,
): CoachFeedbackEdit[] {
  return [...(existing ?? []), edit];
}

/** Map stored / legacy scale values to 1–5 or N/A. */
export function normalizeScaleValue(
  raw: unknown,
): CoachFeedbackScaleValue | null {
  const parsed = parseFivePointChoice(raw);
  if (parsed != null) return parsed;
  if (typeof raw === 'string') {
    const legacy: Record<string, FivePointValue> = {
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
