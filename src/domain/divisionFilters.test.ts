import { describe, expect, it } from 'vitest';
import {
  divisionFilterOptionsFromMatches,
  matchMatchesDivisionFilters,
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
  it('collects league tiers, formats, event types, and sides from matches', () => {
    const options = divisionFilterOptionsFromMatches([
      match({ id: 'm1', matchType: '15s' }),
      match({ id: 'm2', matchType: '7s Tournament', isTournament: true, level: 'Tournament' }),
      match({ id: 'm3', matchType: '2nd Side', level: 'D2' }),
      match({ id: 'm4', level: 'Exhibition' }),
    ]);
    expect(options.levels).toEqual(['D1', 'D2']);
    expect(options.formats).toEqual(['xvs', '7s']);
    expect(options.eventTypes).toEqual(['league', 'exhibition', 'tournament']);
    expect(options.sides).toEqual(['2nd']);
  });

  it('treats unlabeled match types as XVs when filtering', () => {
    const unlabeled = match({ id: 'm3', matchType: '2nd Side' });
    const sevens = match({ id: 'm2', matchType: '7s' });
    expect(
      matchMatchesMultiDivisionFilters(unlabeled, {
        genders: [],
        levels: [],
        competitions: [],
        formats: ['xvs'],
        eventTypes: [],
        sides: [],
      }),
    ).toBe(true);
    expect(
      matchMatchesMultiDivisionFilters(sevens, {
        genders: [],
        levels: [],
        competitions: [],
        formats: ['xvs'],
        eventTypes: [],
        sides: [],
      }),
    ).toBe(false);
  });

  it('filters by event type and side', () => {
    const tournament = match({
      id: 't1',
      isTournament: true,
      level: 'Tournament',
      matchType: '7s',
    });
    const secondSide = match({ id: 's1', matchType: '2nd Side', level: 'D3' });

    expect(
      matchMatchesDivisionFilters(
        tournament,
        null,
        null,
        null,
        null,
        'tournament',
        null,
      ),
    ).toBe(true);
    expect(
      matchMatchesDivisionFilters(
        secondSide,
        null,
        null,
        null,
        null,
        null,
        '2nd',
      ),
    ).toBe(true);
    expect(
      matchMatchesDivisionFilters(
        secondSide,
        null,
        'D3',
        null,
        null,
        'league',
        null,
      ),
    ).toBe(true);
    expect(
      matchMatchesDivisionFilters(
        tournament,
        null,
        'D3',
        null,
        null,
        null,
        null,
      ),
    ).toBe(false);
  });
});
