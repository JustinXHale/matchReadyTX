import { beforeEach, describe, expect, it, vi } from 'vitest';
import { persistSubmittedCardReport } from '@/services/reportsLive';

const mocks = vi.hoisted(() => ({ save: vi.fn(), upsert: vi.fn() }));
vi.mock('@/services/orgData', () => ({
  defaultOrgId: () => 'lonestar',
  saveCardReportWithCasesInFirestore: mocks.save,
}));
vi.mock('@/services/demoStore', () => ({
  demoStore: { upsertCardReportLocal: mocks.upsert },
}));

const input = {
  matchId: 'match-1', officialId: 'mo-1', competitionUnion: '' as const,
  officialName: 'MO', officialEmail: 'mo@example.com', officialPhone: '123',
  matchDate: '2026-09-12',
  cards: [{
    id: 'card-1', color: 'yellow' as const, playerName: 'Player',
    teamId: 'home', teamName: 'Home', reason: 'Foul play',
    receivedAnotherCard: true,
    secondOffense: { color: 'second_yellow_red' as const,
      approximateTime: '60', lawIds: [], summary: 'Second offense' },
  }],
};

describe('live card submission', () => {
  beforeEach(() => vi.resetAllMocks());

  it('publishes locally only after the report and both judicial incidents save', async () => {
    let finish!: () => void;
    mocks.save.mockReturnValue(new Promise<void>((resolve) => { finish = resolve; }));
    const submission = persistSubmittedCardReport(input);
    expect(mocks.upsert).not.toHaveBeenCalled();
    const [org, report, cases] = mocks.save.mock.calls[0];
    expect(org).toBe('lonestar');
    expect(cases).toHaveLength(2);
    expect(cases.map((c: { reportId: string }) => c.reportId)).toEqual([report.id, report.id]);
    expect(cases.map((c: { status: string }) => c.status)).toEqual(['recorded', 'pending']);
    finish();
    await submission;
    expect(mocks.upsert).toHaveBeenCalledWith(report);
  });

  it('keeps a failed submission out of the on-file list and surfaces the error', async () => {
    mocks.save.mockRejectedValue(new Error('Permission denied'));
    await expect(persistSubmittedCardReport(input)).rejects.toThrow('Permission denied');
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
});
