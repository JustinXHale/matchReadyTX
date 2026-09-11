import { describe, expect, it } from 'vitest';
import {
  applyMatchDivision,
  composeMatchTypeLabel,
  parseMatchDivision,
  parseMatchEventType,
  parseMatchSide,
  tierOptionsFromOrgLevels,
} from '@/domain/matchDivision';
import type { Match } from '@/domain/types';

const tierOptions = ['Tier 1', 'Tier 2', 'Tier 3', 'Tier 4'];

function match(
  partial: Partial<Match> & Pick<Match, 'gender' | 'level'>,
): Match {
  return {
    id: 'm1',
    sheetRowKey: 's1',
    status: 'crew_pending',
    kickoffAt: '2026-09-10T18:00:00.000Z',
    venueName: 'Field',
    venueAddress: '123 Main',
    homeTeamId: 'h1',
    awayTeamId: 'a1',
    homeTeamName: 'Home',
    awayTeamName: 'Away',
    flightProvided: false,
    housingProvided: false,
    crew: { mo: [], ar1: [], ar2: [], no4: [] },
    ...partial,
  };
}

describe('matchDivision', () => {
  it('derives tier options from org levels and fills D4 when D1–D3 present', () => {
    expect(
      tierOptionsFromOrgLevels([
        'D1',
        'D2',
        'D3',
        'Exhibition',
        'Tourney',
        '7s',
      ]),
    ).toEqual(['D1', 'D2', 'D3', 'D4']);
    expect(
      tierOptionsFromOrgLevels([
        'Tier 1',
        'Tier 2',
        'Exhibition',
        'Tourney',
        '7s',
      ]),
    ).toEqual(['Tier 1', 'Tier 2', 'Tier 3', 'Tier 4']);
  });

  it('parses tournament from flag or legacy Tourney level', () => {
    expect(parseMatchEventType(match({ gender: 'men', level: 'Tier 1', isTournament: true }))).toBe(
      'tournament',
    );
    expect(parseMatchEventType(match({ gender: 'men', level: 'Tourney' }))).toBe(
      'tournament',
    );
  });

  it('parses side and format from matchType', () => {
    expect(parseMatchSide({ matchType: '2nd Side' })).toBe('2nd');
    expect(
      parseMatchDivision(
        match({ gender: 'women', level: 'Tier 2', matchType: '7s 2nd Side' }),
        tierOptions,
      ),
    ).toEqual({
      gender: 'women',
      tier: 'Tier 2',
      eventType: 'league',
      format: '7s',
      side: '2nd',
    });
  });

  it('applies division selections to match fields', () => {
    expect(
      applyMatchDivision({
        gender: 'women',
        tier: 'Tier 3',
        eventType: 'tournament',
        format: '7s',
        side: null,
      }),
    ).toEqual({
      gender: 'women',
      level: 'Tournament',
      isTournament: true,
      matchType: '7s',
    });

    expect(
      applyMatchDivision({
        gender: 'men',
        tier: 'Tier 1',
        eventType: 'league',
        format: 'xvs',
        side: '3rd',
      }),
    ).toEqual({
      gender: 'men',
      level: 'Tier 1',
      isTournament: false,
      matchType: '3rd Side',
    });
  });

  it('clears matchType when XVs with no side', () => {
    expect(composeMatchTypeLabel('xvs', null)).toBeUndefined();
  });
});
