import { describe, expect, it } from 'vitest';
import {
  needsCardReportNudge,
  totalCardsFromMoPayload,
  type MatchReport,
  type MoReportPayload,
} from '@/domain/reports';

const tournamentPayload: MoReportPayload = {
  homePoints: 0,
  awayPoints: 0,
  yellowCards: 0,
  redCards: 0,
  tournamentMatch: true,
};

const leaguePayload: MoReportPayload = {
  homePoints: 21,
  awayPoints: 14,
  homeYellowCards: 2,
  homeRedCards: 1,
  awayYellowCards: 0,
  awayRedCards: 0,
  yellowCards: 2,
  redCards: 1,
};

describe('tournament match reports', () => {
  it('totalCardsFromMoPayload returns zero when tournamentMatch is set', () => {
    expect(totalCardsFromMoPayload(tournamentPayload)).toEqual({
      yellow: 0,
      red: 0,
    });
    expect(totalCardsFromMoPayload(leaguePayload)).toEqual({
      yellow: 2,
      red: 1,
    });
  });

  it('needsCardReportNudge skips tournament MO reports even with legacy card totals', () => {
    const report: MatchReport = {
      id: 'r1',
      matchId: 'm1',
      officialId: 'u1',
      slot: 'mo',
      status: 'submitted',
      dueAt: '2026-01-01T12:00:00.000Z',
      kickoffAt: '2026-01-01T10:00:00.000Z',
      moPayload: {
        ...tournamentPayload,
        yellowCards: 3,
        redCards: 1,
      },
    };
    expect(needsCardReportNudge(report, [])).toBe(false);
    expect(
      needsCardReportNudge(
        { ...report, moPayload: leaguePayload },
        [],
      ),
    ).toBe(true);
  });
});
