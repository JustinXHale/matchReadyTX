import { describe, expect, it } from 'vitest';
import {
  applyRaiseHandInterestBatch,
  raiseHandInterestStatusLabel,
  sortedRaiseHandInterest,
  syncRaiseHandInterestOnMatch,
} from '@/domain/raiseHandInterest';
import { emptyCrew, type GameRequest, type Match } from '@/domain/types';

function testMatch(): Match {
  return {
    id: 'm1',
    sheetRowKey: 'row-1',
    status: 'crew_pending',
    kickoffAt: '2026-09-19T16:00:00.000Z',
    venueName: 'Field',
    venueAddress: '1 Main',
    homeTeamId: 't1',
    awayTeamId: 't2',
    homeTeamName: 'Home',
    awayTeamName: 'Away',
    level: 'Tier 2',
    gender: 'men',
    flightProvided: false,
    housingProvided: false,
    crew: emptyCrew(),
  };
}

function request(
  overrides: Partial<GameRequest> & Pick<GameRequest, 'id' | 'userId'>,
): GameRequest {
  return {
    matchId: 'm1',
    userName: 'Ref One',
    preferredSlots: ['mo'],
    status: 'pending',
    createdAt: '2026-09-17T10:00:00.000Z',
    ...overrides,
  };
}

describe('raiseHandInterest', () => {
  it('keeps declined volunteers on the match after fulfillment', () => {
    let match = testMatch();
    const pending = request({ id: 'gr1', userId: 'u1' });
    match = syncRaiseHandInterestOnMatch(match, pending);
    const declined = {
      ...pending,
      status: 'declined' as const,
      declineReason: 'Match assignment has been fulfilled',
    };
    match = applyRaiseHandInterestBatch(match, [declined], '2026-09-17T11:00:00.000Z');
    const rows = sortedRaiseHandInterest(match);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe('declined');
    expect(rows[0]?.declineReason).toContain('fulfilled');
    expect(raiseHandInterestStatusLabel(rows[0]!)).toBe('Declined');
  });
});
