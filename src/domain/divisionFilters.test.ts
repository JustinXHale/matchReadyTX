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

describe('divisionFilters gameplay format', () => {
  it('collects unique 7s/10s/15s formats from match type labels', () => {
    const options = divisionFilterOptionsFromMatches([
      match({ id: 'm1', matchType: '15s' }),
      match({ id: 'm2', matchType: '7s Tournament' }),
      match({ id: 'm3', matchType: '2nd Side' }),
      match({ id: 'm4', matchType: '15s' }),
    ]);
    expect(options.formats).toEqual(['15s', '7s']);
  });

  it('treats unlabeled match types as 15s when filtering', () => {
    const unlabeled = match({ id: 'm3', matchType: '2nd Side' });
    const sevens = match({ id: 'm2', matchType: '7s' });
    expect(
      matchMatchesMultiDivisionFilters(unlabeled, {
        genders: [],
        levels: [],
        competitions: [],
        formats: ['15s'],
      }),
    ).toBe(true);
    expect(
      matchMatchesMultiDivisionFilters(sevens, {
        genders: [],
        levels: [],
        competitions: [],
        formats: ['15s'],
      }),
    ).toBe(false);
  });
});
