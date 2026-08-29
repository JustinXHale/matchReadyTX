import { describe, expect, it } from 'vitest';
import type { MatchReport } from '@/domain/reports';
import type { UserProfile } from '@/domain/types';
import {
  cmoFilterOptionsFromOfficialIds,
  reportMatchesCmoFilter,
} from '@/features/insights/insightsDisplay';

function cmoReport(
  officialId: string,
  legacyName?: string,
): MatchReport {
  return {
    id: `r-${officialId}`,
    matchId: 'm1',
    officialId,
    slot: 'cmo',
    status: 'submitted',
    kickoffAt: '2026-01-01T15:00:00.000Z',
    legacyFixture: legacyName ? { cmoOfficialName: legacyName } : undefined,
  } as MatchReport;
}

describe('cmoFilterOptionsFromOfficialIds', () => {
  it('merges duplicate display names from different official ids', () => {
    const reports = [
      cmoReport('uid-a'),
      cmoReport('uid-b'),
      cmoReport('uid-c', 'Jon Savage'),
    ];
    const users = [
      {
        uid: 'uid-a',
        displayName: 'Blair McClure',
        firstName: 'Blair',
        lastName: 'McClure',
        roles: ['cmo'],
        teamIds: [],
      },
      {
        uid: 'uid-b',
        displayName: 'Blair McClure',
        firstName: 'Blair',
        lastName: 'McClure',
        roles: ['cmo'],
        teamIds: [],
      },
    ] as unknown as UserProfile[];

    const options = cmoFilterOptionsFromOfficialIds(
      ['uid-a', 'uid-b', 'uid-c'],
      reports,
      users,
    );

    expect(options).toHaveLength(2);
    expect(options[0]?.name).toBe('Blair McClure');
    expect(options[0]?.officialIds).toEqual(['uid-a', 'uid-b']);
    expect(reportMatchesCmoFilter(cmoReport('uid-b'), options[0]!.value)).toBe(
      true,
    );
  });
});
