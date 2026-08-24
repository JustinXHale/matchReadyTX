import {
  coachFeedbackAverage,
  COACH_FEEDBACK_SCALE_KEYS,
  type CoachFeedback,
} from '@/domain/coachFeedback';
import { isFivePointValue } from '@/domain/fivePointScale';
import { pastMatchesForMember } from '@/domain/members';
import type { CardReport, MatchReport } from '@/domain/reports';
import { totalCardsFromMoPayload } from '@/domain/reports';
import {
  assignmentForUser,
  crewPeople,
  type Match,
  type UserProfile,
} from '@/domain/types';

export type GradeTier = {
  level: number;
  label: string;
  officialCount: number;
  avgCoachFeedback: number | null;
  avgCmoRating: number | null;
};

export type OfficialInsightRow = {
  userId: string;
  name: string;
  assessedLevel?: number;
  refereeLevel?: number;
  coachFeedbackCount: number;
  coachFeedbackAvg: number | null;
  cmoReportCount: number;
  cmoRatingAvg: number | null;
};

const TIER_LABELS: Record<number, string> = {
  10: 'Level 10 (C4)',
  9: 'Level 9',
  8: 'Level 8',
  7: 'Level 7',
  6: 'Level 6 (C1+)',
};

export const GRADE_TIER_ORDER = [6, 7, 8, 9, 10, 0] as const;

function officialGrade(user: UserProfile): number | null {
  if (user.assessedLevel != null) return user.assessedLevel;
  if (user.refereeLevel != null) return user.refereeLevel;
  return null;
}

function tierForGrade(grade: number | null): number {
  if (grade == null) return 0;
  if (grade >= 10) return 10;
  if (grade <= 6) return 6;
  return grade;
}

function matchMap(matches: Match[]): Map<string, Match> {
  return new Map(matches.map((m) => [m.id, m]));
}

export function cmoSubjectOfficialId(
  report: MatchReport,
  matchById: Map<string, Match>,
): string | undefined {
  if (report.subjectOfficialId) return report.subjectOfficialId;
  const match = matchById.get(report.matchId);
  if (!match) return undefined;
  return crewPeople(match.crew.mo).find((a) => a.userId)?.userId;
}

export function globalCoachFeedbackStats(feedback: CoachFeedback[]): {
  submittedCount: number;
  globalAverage: number | null;
  criterionAverages: Partial<Record<string, number>>;
} {
  const submitted = feedback.filter((f) => f.status === 'submitted');
  const avgs = submitted
    .map((f) => coachFeedbackAverage(f.scales))
    .filter((a): a is number => a != null);
  const globalAverage =
    avgs.length ? avgs.reduce((s, v) => s + v, 0) / avgs.length : null;

  const criterionSums: Record<string, { sum: number; count: number }> = {};
  for (const key of COACH_FEEDBACK_SCALE_KEYS) {
    criterionSums[key] = { sum: 0, count: 0 };
  }
  for (const f of submitted) {
    for (const key of COACH_FEEDBACK_SCALE_KEYS) {
      const v = f.scales[key];
      if (isFivePointValue(v)) {
        criterionSums[key].sum += v;
        criterionSums[key].count += 1;
      }
    }
  }
  const criterionAverages: Partial<Record<string, number>> = {};
  for (const key of COACH_FEEDBACK_SCALE_KEYS) {
    const { sum, count } = criterionSums[key];
    if (count > 0) criterionAverages[key] = sum / count;
  }

  return {
    submittedCount: submitted.length,
    globalAverage,
    criterionAverages,
  };
}

export function officialInsightRows(
  users: UserProfile[],
  coachFeedback: CoachFeedback[],
  cmoReports: MatchReport[],
  matches: Match[] = [],
): OfficialInsightRow[] {
  const matchById = matchMap(matches);
  const refs = users.filter(
    (u) => u.roles.includes('official'),
  );
  const coachByOfficial = new Map<string, CoachFeedback[]>();
  for (const f of coachFeedback) {
    if (f.status !== 'submitted' || !f.officialUserId) continue;
    const list = coachByOfficial.get(f.officialUserId) ?? [];
    list.push(f);
    coachByOfficial.set(f.officialUserId, list);
  }

  const cmoBySubject = new Map<string, MatchReport[]>();
  for (const r of cmoReports) {
    if (r.status !== 'submitted' || r.slot !== 'cmo') continue;
    const subject = cmoSubjectOfficialId(r, matchById);
    if (!subject) continue;
    const list = cmoBySubject.get(subject) ?? [];
    list.push(r);
    cmoBySubject.set(subject, list);
  }

  return refs.map((u) => {
    const coachRows = coachByOfficial.get(u.uid) ?? [];
    const coachAvgs = coachRows
      .map((f) => coachFeedbackAverage(f.scales))
      .filter((a): a is number => a != null);
    const cmoRows = cmoBySubject.get(u.uid) ?? [];
    const cmoRatings = cmoRows
      .map((r) => r.cmoPayload?.assessedRating)
      .filter((n): n is number => typeof n === 'number');
    return {
      userId: u.uid,
      name: u.displayName || `${u.firstName} ${u.lastName}`.trim(),
      assessedLevel: u.assessedLevel,
      refereeLevel: u.refereeLevel,
      coachFeedbackCount: coachRows.length,
      coachFeedbackAvg: coachAvgs.length
        ? coachAvgs.reduce((s, v) => s + v, 0) / coachAvgs.length
        : null,
      cmoReportCount: cmoRows.length,
      cmoRatingAvg: cmoRatings.length
        ? cmoRatings.reduce((s, v) => s + v, 0) / cmoRatings.length
        : null,
    };
  });
}

/** Officials with at least one submitted coach feedback or CMO coaching report. */
export function reviewedOfficialInsightRows(
  users: UserProfile[],
  coachFeedback: CoachFeedback[],
  cmoReports: MatchReport[],
  matches: Match[] = [],
): OfficialInsightRow[] {
  return officialInsightRows(users, coachFeedback, cmoReports, matches).filter(
    (row) => row.coachFeedbackCount > 0 || row.cmoReportCount > 0,
  );
}

export function gradePyramid(
  users: UserProfile[],
  coachFeedback: CoachFeedback[],
  cmoReports: MatchReport[],
  matches: Match[] = [],
): GradeTier[] {
  const matchById = matchMap(matches);
  const refs = users.filter(
    (u) => u.roles.includes('official'),
  );
  const coachByOfficial = new Map<string, number[]>();
  for (const f of coachFeedback) {
    if (f.status !== 'submitted' || !f.officialUserId) continue;
    const avg = coachFeedbackAverage(f.scales);
    if (avg == null) continue;
    const list = coachByOfficial.get(f.officialUserId) ?? [];
    list.push(avg);
    coachByOfficial.set(f.officialUserId, list);
  }
  const cmoBySubject = new Map<string, number[]>();
  for (const r of cmoReports) {
    if (r.status !== 'submitted' || r.slot !== 'cmo') continue;
    const subject = cmoSubjectOfficialId(r, matchById);
    if (!subject) continue;
    const rating = r.cmoPayload?.assessedRating;
    if (typeof rating !== 'number') continue;
    const list = cmoBySubject.get(subject) ?? [];
    list.push(rating);
    cmoBySubject.set(subject, list);
  }

  const tiers = new Map<number, { count: number; coach: number[]; cmo: number[] }>();
  for (const tier of GRADE_TIER_ORDER) {
    tiers.set(tier, { count: 0, coach: [], cmo: [] });
  }
  for (const u of refs) {
    const tier = tierForGrade(officialGrade(u));
    const bucket = tiers.get(tier)!;
    bucket.count += 1;
    const coachAvgs = coachByOfficial.get(u.uid);
    if (coachAvgs?.length) {
      bucket.coach.push(
        coachAvgs.reduce((s, v) => s + v, 0) / coachAvgs.length,
      );
    }
    const cmoAvgs = cmoBySubject.get(u.uid);
    if (cmoAvgs?.length) {
      bucket.cmo.push(
        cmoAvgs.reduce((s, v) => s + v, 0) / cmoAvgs.length,
      );
    }
  }

  const order = [...GRADE_TIER_ORDER];
  return order.map((level) => {
    const bucket = tiers.get(level)!;
    const label =
      level === 0
        ? 'Ungraded / unknown'
        : (TIER_LABELS[level] ?? `Level ${level}`);
    return {
      level,
      label,
      officialCount: bucket.count,
      avgCoachFeedback: bucket.coach.length
        ? bucket.coach.reduce((s, v) => s + v, 0) / bucket.coach.length
        : null,
      avgCmoRating: bucket.cmo.length
        ? bucket.cmo.reduce((s, v) => s + v, 0) / bucket.cmo.length
        : null,
    };
  });
}

export function submittedCmoReports(reports: MatchReport[]): MatchReport[] {
  return reports.filter((r) => r.slot === 'cmo' && r.status === 'submitted');
}

export function cmoReportStats(reports: MatchReport[]): {
  submittedCount: number;
  globalAverage: number | null;
} {
  const submitted = submittedCmoReports(reports);
  const ratings = submitted
    .map((r) => r.cmoPayload?.assessedRating)
    .filter((n): n is number => typeof n === 'number');
  return {
    submittedCount: submitted.length,
    globalAverage: ratings.length
      ? ratings.reduce((s, v) => s + v, 0) / ratings.length
      : null,
  };
}

export function officialsInGradeTier(
  users: UserProfile[],
  level: number,
): UserProfile[] {
  const refs = users.filter(
    (u) => u.roles.includes('official'),
  );
  return refs
    .filter((u) => tierForGrade(officialGrade(u)) === level)
    .sort((a, b) =>
      memberDisplayName(a).localeCompare(memberDisplayName(b)),
    );
}

function memberDisplayName(user: UserProfile): string {
  return user.displayName || `${user.firstName} ${user.lastName}`.trim();
}

export type ReportTrendBucket = {
  monthKey: string;
  label: string;
  coachCount: number;
  cmoCount: number;
};

function monthKeyFromIso(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function monthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(undefined, {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** Rolling monthly buckets for dashboard trend chart (oldest → newest). */
export function reportTrendByMonth(
  coachFeedback: CoachFeedback[],
  matchReports: MatchReport[],
  monthCount = 6,
): ReportTrendBucket[] {
  const coachDates = coachFeedback
    .filter((f) => f.status === 'submitted')
    .map((f) => f.updatedAt || f.createdAt);
  const cmoDates = submittedCmoReports(matchReports).map(
    (r) => r.submittedAt || r.kickoffAt,
  );

  const now = new Date();
  const monthKeys: string[] = [];
  for (let i = monthCount - 1; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    monthKeys.push(`${y}-${m}`);
  }

  return monthKeys.map((monthKey) => {
    const coachCount = coachDates.filter(
      (iso) => monthKeyFromIso(iso) === monthKey,
    ).length;
    const cmoCount = cmoDates.filter(
      (iso) => monthKeyFromIso(iso) === monthKey,
    ).length;
    return {
      monthKey,
      label: monthLabel(monthKey),
      coachCount,
      cmoCount,
    };
  });
}

/** Cumulative season-style totals for one official (org matches on file). */
export type OfficialSeasonStats = {
  gamesPast: number;
  gamesMo: number;
  gamesAr: number;
  gamesCmo: number;
  moReportsSubmitted: number;
  coachFeedbackCount: number;
  coachFeedbackAvg: number | null;
  cmoReportsReceived: number;
  cmoRatingAvg: number | null;
  cmoReportsFiled: number;
  yellowCards: number;
  redCards: number;
  avgScoreMargin: number | null;
  moGamesWithScore: number;
};

export function officialCoachFeedbackStatsForUser(
  userId: string,
  feedback: CoachFeedback[],
): {
  submittedCount: number;
  globalAverage: number | null;
  criterionAverages: Partial<Record<string, number>>;
} {
  const submitted = feedback.filter(
    (f) => f.status === 'submitted' && f.officialUserId === userId,
  );
  const avgs = submitted
    .map((f) => coachFeedbackAverage(f.scales))
    .filter((a): a is number => a != null);
  const globalAverage =
    avgs.length ? avgs.reduce((s, v) => s + v, 0) / avgs.length : null;

  const criterionSums: Record<string, { sum: number; count: number }> = {};
  for (const key of COACH_FEEDBACK_SCALE_KEYS) {
    criterionSums[key] = { sum: 0, count: 0 };
  }
  for (const f of submitted) {
    for (const key of COACH_FEEDBACK_SCALE_KEYS) {
      const v = f.scales[key];
      if (isFivePointValue(v)) {
        criterionSums[key].sum += v;
        criterionSums[key].count += 1;
      }
    }
  }
  const criterionAverages: Partial<Record<string, number>> = {};
  for (const key of COACH_FEEDBACK_SCALE_KEYS) {
    const { sum, count } = criterionSums[key];
    if (count > 0) criterionAverages[key] = sum / count;
  }

  return {
    submittedCount: submitted.length,
    globalAverage,
    criterionAverages,
  };
}

function scoreMarginForMoGame(
  match: Match,
  moReport: MatchReport | undefined,
): number | null {
  if (match.homeScore != null && match.awayScore != null) {
    return Math.abs(match.homeScore - match.awayScore);
  }
  const p = moReport?.moPayload;
  if (p && typeof p.homePoints === 'number' && typeof p.awayPoints === 'number') {
    return Math.abs(p.homePoints - p.awayPoints);
  }
  return null;
}

export function officialSeasonStats(
  userId: string,
  matches: Match[],
  matchReports: MatchReport[],
  cardReports: CardReport[],
  coachFeedback: CoachFeedback[] = [],
): OfficialSeasonStats {
  const past = pastMatchesForMember(matches, userId);
  let gamesMo = 0;
  let gamesAr = 0;
  let gamesCmo = 0;
  for (const m of past) {
    const slot = assignmentForUser(m, userId)?.slot;
    if (slot === 'mo') gamesMo += 1;
    else if (slot === 'ar1' || slot === 'ar2') gamesAr += 1;
    else if (slot === 'cmo') gamesCmo += 1;
  }

  const moReportsSubmitted = matchReports.filter(
    (r) =>
      r.officialId === userId && r.slot === 'mo' && r.status === 'submitted',
  ).length;

  const cmoReportsFiled = matchReports.filter(
    (r) =>
      r.officialId === userId && r.slot === 'cmo' && r.status === 'submitted',
  ).length;

  const matchById = matchMap(matches);
  const cmoReceived = matchReports.filter(
    (r) =>
      r.slot === 'cmo' &&
      r.status === 'submitted' &&
      cmoSubjectOfficialId(r, matchById) === userId,
  );
  const cmoRatings = cmoReceived
    .map((r) => r.cmoPayload?.assessedRating)
    .filter((n): n is number => typeof n === 'number');

  const coachStats = officialCoachFeedbackStatsForUser(userId, coachFeedback);

  let yellowCards = 0;
  let redCards = 0;
  const submittedCardReports = cardReports.filter(
    (c) => c.officialId === userId && c.status === 'submitted',
  );
  if (submittedCardReports.length > 0) {
    for (const report of submittedCardReports) {
      for (const card of report.cards) {
        if (card.color === 'yellow') yellowCards += 1;
        else if (card.color === 'red') redCards += 1;
      }
    }
  } else {
    for (const r of matchReports) {
      if (
        r.officialId !== userId ||
        r.slot !== 'mo' ||
        r.status !== 'submitted'
      ) {
        continue;
      }
      const totals = totalCardsFromMoPayload(r.moPayload);
      yellowCards += totals.yellow;
      redCards += totals.red;
    }
  }

  const margins: number[] = [];
  for (const m of past) {
    if (!crewPeople(m.crew.mo).some((a) => a.userId === userId)) continue;
    const moReport = matchReports.find(
      (r) =>
        r.matchId === m.id &&
        r.officialId === userId &&
        r.slot === 'mo' &&
        r.status === 'submitted',
    );
    const margin = scoreMarginForMoGame(m, moReport);
    if (margin != null) margins.push(margin);
  }

  return {
    gamesPast: past.length,
    gamesMo,
    gamesAr,
    gamesCmo,
    moReportsSubmitted,
    coachFeedbackCount: coachStats.submittedCount,
    coachFeedbackAvg: coachStats.globalAverage,
    cmoReportsReceived: cmoReceived.length,
    cmoRatingAvg: cmoRatings.length
      ? cmoRatings.reduce((s, v) => s + v, 0) / cmoRatings.length
      : null,
    cmoReportsFiled,
    yellowCards,
    redCards,
    avgScoreMargin: margins.length
      ? margins.reduce((s, v) => s + v, 0) / margins.length
      : null,
    moGamesWithScore: margins.length,
  };
}
