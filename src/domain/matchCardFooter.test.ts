import { describe, expect, it } from 'vitest';
import {
  matchCardEventLabel,
  matchUnconfirmedTeamBadges,
  teamDisplayAbbreviation,
} from '@/domain/matchCardFooter';
import type { Match } from '@/domain/types';
import { emptyCrew } from '@/domain/types';

function match(partial: Partial<Match> & Pick<Match, 'id'>): Match {
  return {
    sheetRowKey: partial.id,
    status: 'pending_team_review',
    kickoffAt: '2026-09-12T14:00:00.000Z',
    venueName: 'Field',
    venueAddress: '123 Main',
    homeTeamId: 'h1',
    awayTeamId: 'a1',
    homeTeamName: 'LETU',
    awayTeamName: 'LETU',
    level: 'Tier 2',
    gender: 'women',
    flightProvided: false,
    housingProvided: false,
    crew: emptyCrew(),
    ...partial,
  };
}

describe('matchCardFooter', () => {
  it('derives event label from format and tournament flag', () => {
    expect(
      matchCardEventLabel(
        match({
          id: 'm1',
          isTournament: true,
          level: 'Tournament',
          matchType: '7s',
        }),
      ),
    ).toBe('7s Tournament');
  });

  it('prefers explicit title over derived label', () => {
    expect(
      matchCardEventLabel(
        match({ id: 'm1', title: 'Spring Showcase', isTournament: true }),
      ),
    ).toBe('Spring Showcase');
  });

  it('builds unconfirmed badges with team abbreviations', () => {
    const teams = new Map([
      ['h1', { abbreviation: 'LETU', name: 'LETU' }],
      ['a1', { abbreviation: 'TAMU', name: 'Texas A&M' }],
    ]);
    const badges = matchUnconfirmedTeamBadges(
      match({
        id: 'm1',
        homeTeamId: 'h1',
        awayTeamId: 'a1',
        homeConfirmedAt: undefined,
        awayConfirmedAt: undefined,
      }),
      teams,
    );
    expect(badges.map((b) => b.label)).toEqual([
      'LETU - unconfirmed',
      'TAMU - unconfirmed',
    ]);
  });

  it('omits confirmed sides', () => {
    const badges = matchUnconfirmedTeamBadges(
      match({
        id: 'm1',
        homeConfirmedAt: '2026-09-01T00:00:00.000Z',
        awayConfirmedAt: undefined,
      }),
      new Map(),
    );
    expect(badges).toHaveLength(1);
    expect(badges[0]?.side).toBe('away');
  });

  it('omits unconfirmed badges for forfeited matches', () => {
    const badges = matchUnconfirmedTeamBadges(
      match({
        id: 'm1',
        forfeitTeamId: 'a1',
        homeScore: 28,
        awayScore: 0,
        homeConfirmedAt: undefined,
        awayConfirmedAt: undefined,
      }),
      new Map([['a1', { abbreviation: 'OU', name: 'Oklahoma University' }]]),
    );
    expect(badges).toEqual([]);
  });

  it('falls back to initials when abbreviation missing', () => {
    expect(teamDisplayAbbreviation(undefined, 'Texas A&M University')).toBe(
      'TAU',
    );
  });
});
