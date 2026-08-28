import type { MatchReport } from '@/domain/reports';
import { crewPeople, type Match, type UserProfile } from '@/domain/types';

export function userDisplayName(user: UserProfile): string {
  return user.displayName || `${user.firstName} ${user.lastName}`.trim();
}

export function cmoSubjectOfficialId(
  report: MatchReport,
  match?: Match,
): string | undefined {
  if (report.subjectOfficialId) return report.subjectOfficialId;
  if (!match) return undefined;
  return crewPeople(match.crew.mo).find((a) => a.userId)?.userId;
}

export function cmoFilerName(
  report: MatchReport,
  users: UserProfile[],
): string {
  const u = users.find((x) => x.uid === report.officialId);
  if (u) return userDisplayName(u);
  const legacy = report.legacyFixture?.cmoOfficialName?.trim();
  if (legacy) return legacy;
  return 'Unknown CMO';
}

export function cmoSubjectName(
  report: MatchReport,
  match: Match | undefined,
  users: UserProfile[],
  fallbackMoLabel?: string,
): string {
  const id = cmoSubjectOfficialId(report, match);
  if (id) {
    const u = users.find((x) => x.uid === id);
    if (u) return userDisplayName(u);
  }
  const legacy = report.legacyFixture?.subjectOfficialName?.trim();
  if (legacy) return legacy;
  return fallbackMoLabel ?? 'Match official';
}
