import { describe, expect, it } from 'vitest';
import {
  MATCH_REPORT_SOURCE_OUTSIDE,
  displayMatchForCmoReport,
} from '@/domain/reports';
import {
  buildOutsideCmoPending,
  buildOutsidePerformancePending,
  findOpenOutsideSession,
  isOutsideCmoUnlockedForReferee,
  isOutsideSessionComplete,
  matchFromOutsideSession,
  outsideMatchId,
  type OutsideCoachingSession,
} from '@/domain/outsideCoaching';

function sampleSession(
  overrides: Partial<OutsideCoachingSession> = {},
): OutsideCoachingSession {
  return {
    id: 'ocs1',
    refereeId: 'ref1',
    coachId: 'cmo1',
    matchDate: '2026-10-04',
    homeTeamName: 'Austin Huns',
    awayTeamName: 'Dallas RFC',
    division: 'Men’s club',
    createdBy: 'ref1',
    createdAt: '2026-10-04T18:00:00.000Z',
    updatedAt: '2026-10-04T18:00:00.000Z',
    ...overrides,
  };
}

describe('outside coaching sessions', () => {
  it('builds a synthetic match from the session fixture', () => {
    const session = sampleSession();
    const match = matchFromOutsideSession(session);
    expect(match.id).toBe(outsideMatchId(session.id));
    expect(match.homeTeamName).toBe('Austin Huns');
    expect(match.awayTeamName).toBe('Dallas RFC');
    expect(match.crew.mo[0]?.userId).toBe('ref1');
    expect(match.cmo?.[0]?.userId).toBe('cmo1');
  });

  it('joins an incomplete session for the same pair and date', () => {
    const open = sampleSession();
    const reports = [buildOutsidePerformancePending(open)];
    const hit = findOpenOutsideSession(
      [open],
      'ref1',
      'cmo1',
      '2026-10-04',
      reports,
    );
    expect(hit?.id).toBe('ocs1');
  });

  it('does not join a completed session', () => {
    const session = sampleSession();
    const perf = {
      ...buildOutsidePerformancePending(session),
      status: 'submitted' as const,
      submittedAt: '2026-10-05T01:00:00.000Z',
    };
    const cmo = {
      ...buildOutsideCmoPending(session),
      status: 'submitted' as const,
      submittedAt: '2026-10-05T02:00:00.000Z',
    };
    expect(isOutsideSessionComplete(session, [perf, cmo])).toBe(true);
    expect(
      findOpenOutsideSession(
        [session],
        'ref1',
        'cmo1',
        '2026-10-04',
        [perf, cmo],
      ),
    ).toBeUndefined();
  });

  it('unlocks CMO view for the referee only after performance submit', () => {
    const session = sampleSession();
    const pendingPerf = buildOutsidePerformancePending(session);
    const submittedCmo = {
      ...buildOutsideCmoPending(session),
      status: 'submitted' as const,
      submittedAt: '2026-10-05T02:00:00.000Z',
    };
    expect(
      isOutsideCmoUnlockedForReferee(session.id, [pendingPerf, submittedCmo]),
    ).toBe(false);

    const submittedPerf = {
      ...pendingPerf,
      status: 'submitted' as const,
      submittedAt: '2026-10-05T01:00:00.000Z',
    };
    expect(
      isOutsideCmoUnlockedForReferee(session.id, [
        submittedPerf,
        submittedCmo,
      ]),
    ).toBe(true);
  });

  it('displays outside reports without a live college fixture', () => {
    const session = sampleSession();
    const report = buildOutsideCmoPending(session);
    expect(report.source).toBe(MATCH_REPORT_SOURCE_OUTSIDE);
    const display = displayMatchForCmoReport(report, []);
    expect(display?.homeTeamName).toBe('Austin Huns');
    expect(display?.awayTeamName).toBe('Dallas RFC');
    expect(display?.matchType).toBe('Outside game');
  });
});
