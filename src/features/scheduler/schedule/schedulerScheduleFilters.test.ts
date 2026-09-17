import { describe, expect, it } from 'vitest';
import { isComplianceHeld } from '@/domain/complianceHold';
import { emptyCrew, type Match } from '@/domain/types';

function heldMatch(): Match {
  return {
    id: 'm-hold',
    sheetRowKey: 'row-hold',
    status: 'crew_confirmed',
    kickoffAt: '2026-09-19T16:00:00.000Z',
    venueName: 'Field',
    venueAddress: 'Waco, TX',
    homeTeamId: 't1',
    awayTeamId: 't2',
    homeTeamName: 'UH',
    awayTeamName: 'Baylor',
    level: 'Tier 2',
    gender: 'men',
    flightProvided: false,
    housingProvided: false,
    crew: emptyCrew(),
    complianceHold: {
      lockedAt: '2026-09-17T12:00:00.000Z',
      lockedByUid: 'a1',
      lockedByName: 'Assigner',
      message: 'Hold',
    },
  };
}

describe('scheduler Locked filter', () => {
  it('matches compliance-held games regardless of workflow status', () => {
    const m = heldMatch();
    expect(isComplianceHeld(m)).toBe(true);
    expect(m.status).toBe('crew_confirmed');
  });
});
