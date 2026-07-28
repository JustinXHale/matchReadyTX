import type { MatchReport } from '@/domain/reports';
import {
  kickoffHasPassed,
  needsCardReportNudge,
  slotForUserOnMatch,
  type CardReport,
  type ReportAssigneeSlot,
} from '@/domain/reports';
import type { Match } from '@/domain/types';
import { crewPeople } from '@/domain/types';
import type { BackNav } from '@/nav/backNav';

export const MATCH_REPORTS_BACK: BackNav = {
  to: '/referee/reports/match',
  label: 'Match Reports',
};

export const COACHING_REPORTS_BACK: BackNav = {
  to: '/referee/reports/coaching',
  label: 'Coaching Reports',
};

export const COACHING_CMO_BACK: BackNav = {
  to: '/referee/reports/coaching/cmo',
  label: 'CMO Reports',
};

export const COACHING_MINE_BACK: BackNav = {
  to: '/referee/reports/coaching/mine',
  label: 'My Coaching Reports',
};

export const CARD_REPORTS_BACK: BackNav = {
  to: '/referee/reports/cards',
  label: 'Card Reports',
};

export function matchReportPath(matchId: string): string {
  return `/referee/reports/match/${matchId}`;
}

export function matchReportViewPath(
  matchId: string,
  opts?: { officialId?: string; slot?: ReportAssigneeSlot },
): string {
  const q = new URLSearchParams();
  if (opts?.officialId) q.set('officialId', opts.officialId);
  if (opts?.slot) q.set('slot', opts.slot);
  const qs = q.toString();
  return `/referee/reports/match/${matchId}/view${qs ? `?${qs}` : ''}`;
}

export function cmoReportPath(matchId: string): string {
  return `/referee/reports/coaching/${matchId}`;
}

export function cmoReportViewPath(matchId: string): string {
  return `/referee/reports/coaching/${matchId}/view`;
}

export function cardReportPath(matchId: string): string {
  return `/referee/reports/match/${matchId}/cards`;
}

export function pendingReportForUserOnMatch(
  reports: MatchReport[],
  matchId: string,
  userId: string,
): MatchReport | undefined {
  return reports.find(
    (r) =>
      r.matchId === matchId &&
      r.officialId === userId &&
      r.status === 'pending',
  );
}

export function submittedMatchReportsForMatch(
  reports: MatchReport[],
  matchId: string,
): MatchReport[] {
  return reports.filter(
    (r) =>
      r.matchId === matchId &&
      r.status === 'submitted' &&
      r.slot !== 'cmo',
  );
}

export function submittedMoReportForMatch(
  reports: MatchReport[],
  matchId: string,
): MatchReport | undefined {
  return submittedMatchReportsForMatch(reports, matchId).find(
    (r) => r.slot === 'mo',
  );
}

export function submittedCmoReportForMatch(
  reports: MatchReport[],
  matchId: string,
): MatchReport | undefined {
  return reports.find(
    (r) =>
      r.matchId === matchId &&
      r.slot === 'cmo' &&
      r.status === 'submitted',
  );
}

export function submittedCardReportForMatch(
  cardReports: CardReport[],
  matchId: string,
): CardReport | undefined {
  return cardReports.find(
    (c) => c.matchId === matchId && c.status === 'submitted',
  );
}

export function resolveSubmittedMatchReport(
  reports: MatchReport[],
  matchId: string,
  opts?: { officialId?: string; slot?: string },
): MatchReport | undefined {
  const pool = submittedMatchReportsForMatch(reports, matchId);
  if (pool.length === 0) return undefined;
  if (opts?.officialId && opts?.slot) {
    return pool.find(
      (r) => r.officialId === opts.officialId && r.slot === opts.slot,
    );
  }
  if (opts?.slot) {
    const bySlot = pool.find((r) => r.slot === opts.slot);
    if (bySlot) return bySlot;
  }
  if (opts?.officialId) {
    const byOfficial = pool.find((r) => r.officialId === opts.officialId);
    if (byOfficial) return byOfficial;
  }
  return pool.find((r) => r.slot === 'mo') ?? pool[0];
}

export function reportHrefForPending(report: MatchReport): string {
  if (report.slot === 'cmo') return cmoReportPath(report.matchId);
  return matchReportPath(report.matchId);
}

export function reportHrefForSubmitted(report: MatchReport): string {
  if (report.slot === 'cmo') return cmoReportViewPath(report.matchId);
  return matchReportViewPath(report.matchId, {
    officialId: report.officialId,
    slot: report.slot,
  });
}

export function matchDetailReportActions(
  match: Match,
  userId: string,
  matchReports: MatchReport[],
  cardReports: CardReport[],
  now = Date.now(),
): {
  primary?: { label: string; to: string };
  cardLink?: { label: string; to: string; nudge: boolean };
} {
  const slot = slotForUserOnMatch(match, userId);
  const pending = pendingReportForUserOnMatch(matchReports, match.id, userId);
  const moSubmitted = matchReports.find(
    (r) =>
      r.matchId === match.id &&
      r.officialId === userId &&
      r.slot === 'mo' &&
      r.status === 'submitted',
  );

  let primary: { label: string; to: string } | undefined;
  if (pending && now >= new Date(pending.dueAt).getTime()) {
    if (pending.slot === 'cmo') {
      primary = {
        label: 'Complete CMO report',
        to: cmoReportPath(match.id),
      };
    } else if (pending.slot === 'mo') {
      primary = {
        label: 'Complete match report',
        to: matchReportPath(match.id),
      };
    } else {
      primary = {
        label: 'Complete AR report',
        to: matchReportPath(match.id),
      };
    }
  }

  let cardLink: { label: string; to: string; nudge: boolean } | undefined;
  if (slot === 'mo' && kickoffHasPassed(match.kickoffAt, now)) {
    const nudge = needsCardReportNudge(moSubmitted, cardReports);
    cardLink = {
      label: nudge ? 'File card report (cards noted)' : 'Card report',
      to: cardReportPath(match.id),
      nudge,
    };
  }

  return { primary, cardLink };
}

/** Compact header links for match detail title row. */
export function matchDetailHeaderReportLinks(
  match: Match,
  userId: string,
  matchReports: MatchReport[],
  cardReports: CardReport[],
  now = Date.now(),
): { label: string; to: string }[] {
  const links: { label: string; to: string }[] = [];
  const pending = pendingReportForUserOnMatch(matchReports, match.id, userId);
  const moSubmitted = submittedMoReportForMatch(matchReports, match.id);
  const cmoSubmitted = submittedCmoReportForMatch(matchReports, match.id);
  const cardSubmitted = submittedCardReportForMatch(cardReports, match.id);
  const isMo = crewPeople(match.crew.mo).some((a) => a.userId === userId);

  if (pending && now >= new Date(pending.dueAt).getTime()) {
    if (pending.slot === 'cmo') {
      links.push({ label: 'Complete coaching report', to: cmoReportPath(match.id) });
    } else {
      links.push({
        label:
          pending.slot === 'mo'
            ? 'Complete match report'
            : 'Complete AR report',
        to: matchReportPath(match.id),
      });
    }
  } else if (moSubmitted) {
    links.push({
      label: 'Match report',
      to: matchReportViewPath(match.id, {
        officialId: moSubmitted.officialId,
        slot: 'mo',
      }),
    });
  }

  if (cmoSubmitted) {
    links.push({
      label: 'Coaching report',
      to: cmoReportViewPath(match.id),
    });
  }

  if (cardSubmitted) {
    links.push({ label: 'Card report', to: cardReportPath(match.id) });
  } else if (isMo && kickoffHasPassed(match.kickoffAt, now)) {
    links.push({ label: 'Card report', to: cardReportPath(match.id) });
  }

  return links;
}
