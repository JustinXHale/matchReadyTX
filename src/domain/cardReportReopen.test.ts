import { describe, expect, it } from 'vitest';
import {
  latestReopenForReport,
  pendingCardReportReopenRequests,
  pendingReopenForReport,
  validateDenyReason,
  validateReopenRequestReason,
} from '@/domain/cardReportReopen';
import type { CardReportReopenRequest } from '@/domain/types';
import {
  isCardReportEditable,
  isCardReportLocked,
  type CardReport,
} from '@/domain/reports';

function req(
  partial: Partial<CardReportReopenRequest> & { id: string },
): CardReportReopenRequest {
  return {
    orgId: 'lonestar',
    matchId: 'm1',
    reportId: 'r1',
    requesterUserId: 'u1',
    requesterName: 'MO',
    requesterEmail: 'mo@x.com',
    matchLabel: 'Home vs Away',
    requestReason: 'Need more cards',
    status: 'pending',
    createdAt: '2026-10-01T00:00:00.000Z',
    ...partial,
  };
}

describe('card report reopen helpers', () => {
  it('filters pending reopen requests', () => {
    const list = [
      req({ id: 'a', status: 'pending' }),
      req({ id: 'b', status: 'denied' }),
    ];
    expect(pendingCardReportReopenRequests(list)).toHaveLength(1);
    expect(pendingReopenForReport(list, 'r1')?.id).toBe('a');
  });

  it('returns latest reopen by createdAt', () => {
    const list = [
      req({ id: 'old', createdAt: '2026-09-01T00:00:00.000Z', status: 'denied' }),
      req({
        id: 'new',
        createdAt: '2026-10-01T00:00:00.000Z',
        status: 'pending',
      }),
    ];
    expect(latestReopenForReport(list, 'r1')?.id).toBe('new');
  });

  it('validates request and deny reasons', () => {
    expect(validateReopenRequestReason('')).toBeTruthy();
    expect(validateReopenRequestReason('Need to add cards')).toBeNull();
    expect(validateDenyReason('')).toBeTruthy();
    expect(validateDenyReason('Already reviewed by judicial')).toBeNull();
  });
});

describe('card report lock helpers', () => {
  const base: CardReport = {
    id: 'r1',
    matchId: 'm1',
    officialId: 'u1',
    status: 'submitted',
    competitionUnion: '',
    officialName: 'MO',
    officialEmail: 'a@b.c',
    officialPhone: '1',
    matchDate: '2026-10-01',
    cards: [],
    createdAt: '2026-10-01T00:00:00.000Z',
    submittedAt: '2026-10-01T00:00:00.000Z',
  };

  it('treats draft as editable and submitted as locked', () => {
    expect(isCardReportEditable({ ...base, status: 'draft' })).toBe(true);
    expect(isCardReportLocked(base)).toBe(true);
    expect(
      isCardReportEditable({
        ...base,
        editUnlockedAt: '2026-10-02T00:00:00.000Z',
      }),
    ).toBe(true);
    expect(
      isCardReportLocked({
        ...base,
        editUnlockedAt: '2026-10-02T00:00:00.000Z',
      }),
    ).toBe(false);
  });
});
