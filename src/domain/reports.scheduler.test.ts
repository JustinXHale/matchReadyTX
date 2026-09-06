import { describe, expect, it } from 'vitest';
import {
  buildResetMatchReport,
  matchReportsForAssignee,
  officialHasCrewReportSlot,
  submittedCrewReportForAssignee,
  type MatchReport,
} from '@/domain/reports';
import { emptyCrew, type Match } from '@/domain/types';

function baseMatch(): Match {
  const kickoffAt = '2026-09-05T13:30:00.000Z';
  return {
    id: 'T1',
    sheetRowKey: 'T1',
    status: 'locked_confirmed',
    kickoffAt,
    venueName: 'Field',
    venueAddress: 'Austin, TX',
    homeTeamId: 'h',
    awayTeamId: 'a',
    homeTeamName: 'Home',
    awayTeamName: 'Away',
    level: 'T3',
    gender: 'men',
    flightProvided: false,
    housingProvided: false,
    crew: {
      ...emptyCrew(),
      mo: [
        {
          id: 'ca_mo',
          slot: 'mo',
          userId: 'mo-1',
          userName: 'MO One',
          status: 'confirmed',
          history: [],
        },
      ],
    },
  };
}

describe('scheduler match report admin helpers', () => {
  it('matchReportsForAssignee returns all rows for one assignee slot', () => {
    const reports: MatchReport[] = [
      {
        id: 'r1',
        matchId: 'T1',
        officialId: 'cmo-1',
        slot: 'cmo',
        subjectOfficialId: 'mo-a',
        status: 'submitted',
        dueAt: '2026-09-05T15:00:00.000Z',
        kickoffAt: '2026-09-05T13:30:00.000Z',
      },
      {
        id: 'r2',
        matchId: 'T1',
        officialId: 'cmo-1',
        slot: 'cmo',
        subjectOfficialId: 'mo-b',
        status: 'pending',
        dueAt: '2026-09-05T15:00:00.000Z',
        kickoffAt: '2026-09-05T13:30:00.000Z',
      },
    ];
    expect(
      matchReportsForAssignee(reports, 'T1', 'cmo-1', 'cmo').map((r) => r.id),
    ).toEqual(['r1', 'r2']);
  });

  it('buildResetMatchReport keeps doc id and clears submission', () => {
    const match = baseMatch();
    const submitted: MatchReport = {
      id: 'T1_mo-1_mo',
      matchId: 'T1',
      officialId: 'mo-1',
      slot: 'mo',
      formKind: 'mo_quick',
      status: 'submitted',
      dueAt: '2026-09-05T15:00:00.000Z',
      kickoffAt: match.kickoffAt,
      submittedAt: '2026-09-06T21:00:00.000Z',
      moPayload: {
        homePoints: 12,
        awayPoints: 8,
        yellowCards: 0,
        redCards: 0,
        tournamentMatch: true,
      },
    };
    const reset = buildResetMatchReport(submitted, match);
    expect(reset.id).toBe('T1_mo-1_mo');
    expect(reset.status).toBe('pending');
    expect(reset.submittedAt).toBeUndefined();
    expect(reset.moPayload).toBeUndefined();
    expect(reset.formKind).toBeUndefined();
  });

  it('officialHasCrewReportSlot checks crew assignment', () => {
    const match = baseMatch();
    expect(officialHasCrewReportSlot(match, 'mo-1', 'mo')).toBe(true);
    expect(officialHasCrewReportSlot(match, 'mo-1', 'ar1')).toBe(false);
  });

  it('submittedCrewReportForAssignee finds submitted row by slot', () => {
    const match = baseMatch();
    const reports: MatchReport[] = [
      {
        id: 'r1',
        matchId: match.id,
        officialId: 'mo-1',
        slot: 'mo',
        status: 'submitted',
        dueAt: '2026-09-05T15:00:00.000Z',
        kickoffAt: match.kickoffAt,
      },
    ];
    expect(
      submittedCrewReportForAssignee(reports, match.id, 'mo-1', 'mo')?.id,
    ).toBe('r1');
  });
});
