import { describe, expect, it } from 'vitest';
import { matchReportFromFirestore } from '@/services/orgData';

describe('matchReportFromFirestore', () => {
  it('keeps submitted status and ISO date strings', () => {
    const row = matchReportFromFirestore('T1_u1_mo', {
      matchId: 'T1',
      officialId: 'u1',
      slot: 'mo',
      status: 'submitted',
      dueAt: '2026-09-05T15:00:00.000Z',
      kickoffAt: '2026-09-05T13:30:00.000Z',
      submittedAt: '2026-09-06T21:00:59.000Z',
      formKind: 'mo_quick',
      moPayload: { homePoints: 12, awayPoints: 8, yellowCards: 0, redCards: 0 },
    });
    expect(row?.status).toBe('submitted');
    expect(row?.submittedAt).toBe('2026-09-06T21:00:59.000Z');
    expect(row?.moPayload?.homePoints).toBe(12);
  });

  it('reads Firestore timestamp objects for kickoff/due/submitted', () => {
    const kickoff = new Date('2026-09-05T13:30:00.000Z');
    const row = matchReportFromFirestore('T1_u1_mo', {
      matchId: 'T1',
      officialId: 'u1',
      slot: 'mo',
      status: 'submitted',
      kickoffAt: { toDate: () => kickoff },
      submittedAt: { seconds: kickoff.getTime() / 1000 },
    });
    expect(row?.status).toBe('submitted');
    expect(row?.kickoffAt).toBe('2026-09-05T13:30:00.000Z');
    expect(row?.dueAt).toBe('2026-09-05T15:00:00.000Z');
    expect(row?.submittedAt).toBe('2026-09-05T13:30:00.000Z');
  });
});
