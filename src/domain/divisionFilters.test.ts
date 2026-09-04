import { describe, expect, it } from 'vitest';
import {
  divisionFilterOptionsFromMatches,
  matchMatchesMultiDivisionFilters,
} from '@/domain/divisionFilters';
import type { Match } from '@/domain/types';
import { emptyCrew } from '@/domain/types';

function match(partial: Partial<Match> & Pick<Match, 'id'>): Match {
  return {
    sheetRowKey: partial.id,
    status: 'crew_pending',
    kickoffAt: '2026-03-01T15:00:00.000-06:00',
    venueName: 'Field',
    venueAddress: '123 Main',
    homeTeamId: 'h1',
    awayTeamId: 'a1',
    homeTeamName: 'Home',
    awayTeamName: 'Away',
    level: 'D1',
    gender: 'men',
    flightProvided: false,
    housingProvided: false,
    crew: emptyCrew(),
    ...partial,
  };
}

describe('divisionFilters match type', () => {
  it('collects unique match types from the pool', () => {
    const options = divisionFilterOptionsFromMatches([
      match({ id: 'm1', matchType: '2nd Side' }),
      match({ id: 'm2', matchType: 'League' }),
      match({ id: 'm3', matchType: '2nd Side' }),
      match({ id: 'm4' }),
    ]);
    expect(options.matchTypes).toEqual(['2nd Side', 'League']);
  });

  it('filters matches by match type', () => {
    const league = match({ id: 'm1', matchType: 'League' });
    const side = match({ id: 'm2', matchType: '2nd Side' });
    expect(
      matchMatchesMultiDivisionFilters(league, {
        genders: [],
        levels: [],
        competitions: [],
        matchTypes: ['League'],
      }),
    ).toBe(true);
    expect(
      matchMatchesMultiDivisionFilters(side, {
        genders: [],
        levels: [],
        competitions: [],
        matchTypes: ['League'],
      }),
    ).toBe(false);
  });
});
