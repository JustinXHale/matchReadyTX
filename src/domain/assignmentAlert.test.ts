import { describe, expect, it } from 'vitest';
import { resolveAssignmentAlertStatus } from '@/domain/assignmentAlert';
import type { GameRequest, Match } from '@/domain/types';

function baseMatch(overrides: Partial<Match> = {}): Match {
  return {
    id: 'm1',
    orgId: 'org',
    title: 'Test',
    kickoffAt: new Date().toISOString(),
    gender: 'men',
    level: 'D1',
    status: 'crew_pending',
    homeTeamId: 'h',
    awayTeamId: 'a',
    homeTeamName: 'Home',
    awayTeamName: 'Away',
    crew: {
      mo: [
        {
          id: 'ca1',
          slot: 'mo',
          userId: 'u1',
          userName: 'Ref',
          status: 'official',
          history: [],
        },
      ],
      ar1: [],
      ar2: [],
      no4: [],
    },
    ...overrides,
  } as Match;
}

describe('resolveAssignmentAlertStatus', () => {
  it('uses GameRequest status when present', () => {
    const match = baseMatch();
    const request = {
      id: 'r1',
      matchId: 'm1',
      userId: 'u1',
      userName: 'Ref',
      preferredSlots: ['mo'],
      status: 'declined',
      createdAt: new Date().toISOString(),
    } satisfies GameRequest;
    expect(resolveAssignmentAlertStatus(match, 'u1', request)).toBe('declined');
  });

  it('maps confirmed crew to approved', () => {
    const match = baseMatch({
      crew: {
        mo: [
          {
            id: 'ca1',
            slot: 'mo',
            userId: 'u1',
            userName: 'Ref',
            status: 'confirmed',
            history: [],
          },
        ],
        ar1: [],
        ar2: [],
        no4: [],
      },
    });
    expect(resolveAssignmentAlertStatus(match, 'u1')).toBe('approved');
  });

  it('maps pending accept to pending', () => {
    expect(resolveAssignmentAlertStatus(baseMatch(), 'u1')).toBe('pending');
  });
});
