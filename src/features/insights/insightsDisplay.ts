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

export type CmoFilterOption = {
  /** Pipe-joined official ids (one or more uids sharing the same display name). */
  value: string;
  name: string;
  officialIds: string[];
};

/** One dropdown row per CMO name — merges duplicate roster uids / legacy imports. */
export function cmoFilterOptionsFromOfficialIds(
  officialIds: Iterable<string>,
  reports: MatchReport[],
  users: UserProfile[],
): CmoFilterOption[] {
  const reportByOfficialId = new Map<string, MatchReport>();
  for (const report of reports) {
    if (!reportByOfficialId.has(report.officialId)) {
      reportByOfficialId.set(report.officialId, report);
    }
  }

  const byName = new Map<string, { name: string; officialIds: Set<string> }>();
  for (const officialId of officialIds) {
    const report = reportByOfficialId.get(officialId);
    const name = report
      ? cmoFilerName(report, users)
      : users.find((u) => u.uid === officialId)?.displayName ?? officialId;
    const key = name.toLowerCase().trim();
    const entry = byName.get(key) ?? { name, officialIds: new Set<string>() };
    entry.officialIds.add(officialId);
    byName.set(key, entry);
  }

  return [...byName.values()]
    .map(({ name, officialIds: ids }) => {
      const sorted = [...ids].sort();
      return {
        name,
        officialIds: sorted,
        value: sorted.join('|'),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function reportMatchesCmoFilter(
  report: MatchReport,
  filterValue: string,
): boolean {
  if (!filterValue) return true;
  const ids = new Set(filterValue.split('|'));
  return ids.has(report.officialId);
}

export function rowMatchesCmoFilter(
  filerIds: string[],
  filterValue: string,
): boolean {
  if (!filterValue) return true;
  const ids = new Set(filterValue.split('|'));
  return filerIds.some((id) => ids.has(id));
}
