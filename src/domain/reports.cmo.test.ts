import { describe, expect, it } from 'vitest';
import {
  cmoMatchReportDocId,
  isReportWindowOpen,
  moOfficialIdsOnMatch,
  resolveCmoReportForUserOnMatch,
  syncPendingMatchReports,
  type MatchReport,
} from '@/domain/reports';
import { emptyCrew, type Match } from '@/domain/types';

function tournamentMatch(moUserIds: string[], cmoUserId: string): Match {
  const kickoffAt = new Date('2020-01-01T19:00:00Z').toISOString();
  return {
    id: 'tourney-1',
    sheetRowKey: 't1',
    status: 'locked_confirmed',
    kickoffAt,
    venueName: 'Field',
    venueAddress: 'Austin, TX',
    venueLat: 30.27,
    venueLng: -97.74,
    homeTeamId: 'h',
    awayTeamId: 'a',
    homeTeamName: 'Home',
    awayTeamName: 'Away',
    level: 'Tourney',
    gender: 'men',
    flightProvided: false,
    housingProvided: false,
    crew: {
      ...emptyCrew(),
      mo: moUserIds.map((userId, idx) => ({
        id: `ca_mo_${idx}`,
        slot: 'mo' as const,
        userId,
        userName: `MO ${idx + 1}`,
        status: 'confirmed' as const,
        history: [],
      })),
    },
    cmo: [{ id: 'cmo_1', userId: cmoUserId, userName: 'CMO' }],
  };
}

describe('multi-MO CMO reports', () => {
  it('moOfficialIdsOnMatch returns every linked MO', () => {
    const match = tournamentMatch(['mo-a', 'mo-b'], 'cmo-1');
    expect(moOfficialIdsOnMatch(match)).toEqual(['mo-a', 'mo-b']);
  });

  it('syncPendingMatchReports creates one CMO pending per MO', () => {
    const match = tournamentMatch(['mo-a', 'mo-b'], 'cmo-1');
    const now = new Date('2020-01-01T21:00:00Z').getTime();
    expect(isReportWindowOpen(match.kickoffAt, now)).toBe(true);

    const reports = syncPendingMatchReports([match], [], now);
    const cmoRows = reports.filter((r) => r.slot === 'cmo');
    expect(cmoRows).toHaveLength(2);
    expect(cmoRows.map((r) => r.subjectOfficialId).sort()).toEqual([
      'mo-a',
      'mo-b',
    ]);
    expect(
      new Set(cmoRows.map((r) => r.id)).size,
    ).toBe(2);
  });

  it('uses legacy doc id for single-MO matches', () => {
    const match = tournamentMatch(['mo-a'], 'cmo-1');
    const now = new Date('2020-01-01T21:00:00Z').getTime();
    const [row] = syncPendingMatchReports([match], [], now).filter(
      (r) => r.slot === 'cmo',
    );
    expect(row?.id).toBe(cmoMatchReportDocId('tourney-1', 'cmo-1', 'mo-a', false));
    expect(row?.subjectOfficialId).toBe('mo-a');
  });

  it('resolveCmoReportForUserOnMatch finds report by subject', () => {
    const match = tournamentMatch(['mo-a', 'mo-b'], 'cmo-1');
    const now = new Date('2020-01-01T21:00:00Z').getTime();
    const reports = syncPendingMatchReports([match], [], now);
    const aboutB = resolveCmoReportForUserOnMatch(
      reports,
      match,
      'cmo-1',
      'mo-b',
    );
    expect(aboutB?.subjectOfficialId).toBe('mo-b');
    expect(aboutB?.status).toBe('pending');
  });

  it('keeps submitted CMO rows when syncing', () => {
    const match = tournamentMatch(['mo-a', 'mo-b'], 'cmo-1');
    const now = new Date('2020-01-01T21:00:00Z').getTime();
    const pending = syncPendingMatchReports([match], [], now);
    const submitted: MatchReport = {
      ...pending.find((r) => r.subjectOfficialId === 'mo-a')!,
      status: 'submitted',
      submittedAt: new Date(now).toISOString(),
    };
    const merged = syncPendingMatchReports([match], [submitted], now);
    const moA = merged.find(
      (r) => r.slot === 'cmo' && r.subjectOfficialId === 'mo-a',
    );
    expect(moA?.status).toBe('submitted');
    expect(
      merged.filter((r) => r.slot === 'cmo' && r.status === 'pending'),
    ).toHaveLength(1);
  });
});
