import { describe, expect, it, vi } from 'vitest';
import { cardIncidentsForSubmit, type CardReport } from '@/domain/reports';
import { casesFromCardReport } from '@/domain/judicial';
import { saveCardReportWithCasesInFirestore, subscribeCardReports } from '@/services/orgData';

const mocks = vi.hoisted(() => ({ set: vi.fn(), commit: vi.fn().mockResolvedValue(undefined), onSnapshot: vi.fn() }));
vi.mock('@/services/firebase', () => ({ db: {}, functions: null, isFirebaseConfigured: true }));
vi.mock('firebase/firestore', async (importOriginal) => ({
  ...await importOriginal<typeof import('firebase/firestore')>(),
  doc: (_db: unknown, ...segments: string[]) => segments.join('/'),
  collection: (_db: unknown, ...segments: string[]) => segments.join('/'),
  query: (col: unknown) => col,
  onSnapshot: mocks.onSnapshot,
  writeBatch: () => mocks,
}));

describe('card report persistence', () => {
  it.each([false, true])('waits for server confirmation in the global=%s subscription', (isGlobal) => {
    const onData = vi.fn();
    subscribeCardReports('lonestar', { uid: 'mo-1', isGlobal }, onData);
    const [, options, onSnapshot] = mocks.onSnapshot.mock.lastCall!;
    expect(options).toEqual({ includeMetadataChanges: true });
    onSnapshot({ metadata: { hasPendingWrites: true }, docs: [] });
    expect(onData).not.toHaveBeenCalled();
    onSnapshot({ metadata: { hasPendingWrites: false }, docs: [] });
    expect(onData).toHaveBeenCalledWith([]);
  });

  it('strips optional nested undefined fields and commits report and cases in one batch', async () => {
    const cards = cardIncidentsForSubmit([{
      id: 'incident-1', color: 'yellow', playerName: 'Player',
      playerFirstName: 'Test', playerLastName: 'Player',
      teamId: 'home', teamName: 'Home', reason: 'Foul',
      offenseSummary: 'Foul', lawIds: ['law_9_11_reckless_dangerous'],
    }]);
    expect(cards).toHaveLength(1);
    expect(cards[0]).toHaveProperty('secondOffense', undefined);
    const report: CardReport = {
      id: 'report-1', matchId: 'match-1', officialId: 'mo-1', status: 'submitted',
      competitionUnion: '', officialName: 'MO', officialEmail: 'mo@example.com',
      officialPhone: '123', matchDate: '2026-09-12', createdAt: '2026-09-13T00:00:00Z', cards,
    };
    await saveCardReportWithCasesInFirestore('lonestar', report, casesFromCardReport(report));
    expect(mocks.set).toHaveBeenCalledTimes(2);
    const [path, saved] = mocks.set.mock.calls[0];
    expect(path).toBe('orgs/lonestar/cardReports/report-1');
    expect(saved.cards[0]).not.toHaveProperty('secondOffense');
    expect(saved).toEqual(JSON.parse(JSON.stringify(saved)));
    expect(mocks.set.mock.calls[1][0]).toContain('orgs/lonestar/judicialCases/');
    expect(mocks.commit).toHaveBeenCalledOnce();
  });
});
