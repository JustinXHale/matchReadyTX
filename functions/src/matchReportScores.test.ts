import { describe, expect, it, vi } from 'vitest';
import type { Firestore } from 'firebase-admin/firestore';
import { submittedMatchScore, syncMatchReportScore } from './matchReportScores';

const submitted = {
  slot: 'mo', status: 'submitted', submittedAt: '2026-09-13T10:00:00Z',
  moPayload: { homePoints: 24, awayPoints: 0 },
};

function database(
  match: Record<string, unknown> | undefined,
  reports: Record<string, unknown>[] = [submitted],
) {
  const matchRef = {};
  const query = {};
  const tx = {
    get: vi.fn(async (ref: unknown) => ref === matchRef
      ? { exists: !!match, data: () => match }
      : { docs: reports.map((data, i) => ({ id: `report-${i}`, data: () => data })) }),
    update: vi.fn(),
  };
  const db = {
    collection: vi.fn(() => ({ doc: vi.fn(() => ({
      collection: vi.fn((name: string) => name === 'matches'
        ? { doc: vi.fn(() => matchRef) }
        : { where: vi.fn(() => query) }),
    })) })),
    runTransaction: vi.fn(async (fn: (transaction: typeof tx) => unknown) => fn(tx)),
  };
  return { db: db as unknown as Firestore, tx, matchRef };
}

describe('submittedMatchScore', () => {
  it('includes zero scores', () => {
    expect(submittedMatchScore(submitted)).toEqual({ homeScore: 24, awayScore: 0 });
  });
  it.each([
    { ...submitted, status: 'pending' },
    { ...submitted, slot: 'cmo' },
    { ...submitted, slot: 'ar1' },
    { ...submitted, moPayload: undefined },
    { ...submitted, moPayload: { ...submitted.moPayload, tournamentMatch: true } },
    ...[undefined, null, '24', NaN, Infinity, -1].map((homePoints) => ({
      ...submitted, moPayload: { homePoints, awayPoints: 0 },
    })),
  ])('ignores non-final or invalid scores %#', (report) => {
    expect(submittedMatchScore(report)).toBeUndefined();
  });
});

describe('syncMatchReportScore', () => {
  it('publishes the current submitted score on the shared match', async () => {
    const { db, tx, matchRef } = database({});
    await syncMatchReportScore(db, 'lonestar', 'match-1');
    expect(tx.update).toHaveBeenCalledWith(matchRef, { homeScore: 24, awayScore: 0 });
  });

  it('uses the newest submission, regardless of report ordering', async () => {
    const older = { ...submitted, submittedAt: '2026-09-12T10:00:00Z',
      moPayload: { homePoints: 5, awayPoints: 10 } };
    for (const reports of [[older, submitted], [submitted, older]]) {
      const { db, tx, matchRef } = database({}, reports);
      await syncMatchReportScore(db, 'lonestar', 'match-1');
      expect(tx.update).toHaveBeenCalledWith(matchRef, { homeScore: 24, awayScore: 0 });
    }
  });

  it.each([undefined, { forfeitTeamId: 'home' }, { isTournament: true },
    { homeScore: 24, awayScore: 0 }])('skips missing/protected/unchanged matches %#', async (match) => {
    const { db, tx } = database(match);
    await syncMatchReportScore(db, 'lonestar', 'match-1');
    expect(tx.update).not.toHaveBeenCalled();
  });

  it('does not invent a score for pending reports', async () => {
    const { db, tx } = database({}, [{ ...submitted, status: 'pending' }]);
    await syncMatchReportScore(db, 'lonestar', 'match-1');
    expect(tx.update).not.toHaveBeenCalled();
  });

  it('previews a repair without writing', async () => {
    const { db, tx } = database({});
    expect(await syncMatchReportScore(db, 'lonestar', 'match-1', { write: false }))
      .toEqual({ homeScore: 24, awayScore: 0 });
    expect(tx.update).not.toHaveBeenCalled();
  });

  it('backfill preserves existing final scores', async () => {
    const { db, tx } = database({ homeScore: 10, awayScore: 5 });
    await syncMatchReportScore(db, 'lonestar', 'match-1', { onlyMissing: true });
    expect(tx.update).not.toHaveBeenCalled();
  });
});
