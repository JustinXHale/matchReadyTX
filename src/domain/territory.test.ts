import { describe, expect, it } from 'vitest';
import {
  buildTerritoryLookup,
  parseProximityColumnsAE,
  resolveMatchTerritory,
  resolveOfficialTerritory,
} from './territory';
import type { Match, Team } from './types';

describe('parseProximityColumnsAE', () => {
  it('reads metro headers from row 1 and cities in columns A–E', () => {
    const rows = parseProximityColumnsAE([
      ['AUSTIN', 'DALLAS', 'HOUSTON', 'SAN ANTONIO', 'OKLAHOMA'],
      ['Austin', 'Keller', 'Katy', 'Seguin', 'Norman'],
      ['Round Rock', 'Plano', '', '', 'Edmond'],
    ]);
    expect(rows).toEqual(
      expect.arrayContaining([
        { metro: 'Austin', city: 'Austin' },
        { metro: 'Austin', city: 'Round Rock' },
        { metro: 'Dallas', city: 'Keller' },
        { metro: 'Dallas', city: 'Plano' },
        { metro: 'Houston', city: 'Katy' },
        { metro: 'San Antonio', city: 'Seguin' },
        { metro: 'Oklahoma', city: 'Norman' },
        { metro: 'Oklahoma', city: 'Edmond' },
      ]),
    );
  });
});

describe('resolveOfficialTerritory', () => {
  const lookup = buildTerritoryLookup([
    { metro: 'Dallas', city: 'Keller' },
    { metro: 'Austin', city: 'Round Rock' },
  ]);

  it('matches homeCity case-insensitively', () => {
    expect(
      resolveOfficialTerritory({ homeCity: 'keller' }, lookup),
    ).toBe('Dallas');
    expect(
      resolveOfficialTerritory({ homeCity: 'Round Rock' }, lookup),
    ).toBe('Austin');
  });

  it('returns null when city is not on the sheet', () => {
    expect(
      resolveOfficialTerritory({ homeCity: 'Amarillo' }, lookup),
    ).toBeNull();
  });
});

describe('resolveMatchTerritory', () => {
  const lookup = buildTerritoryLookup([
    { metro: 'Austin', city: 'Austin' },
    { metro: 'Dallas', city: 'Keller' },
  ]);

  const match: Pick<Match, 'venueAddress' | 'homeTeamId'> = {
    venueAddress: 'Westlake Fields, Austin, TX',
    homeTeamId: 'team_austin',
  };

  const teams: Team[] = [
    {
      id: 'team_austin',
      name: 'Austin RFC',
      contactEmails: [],
      address: 'Westlake Fields, Austin, TX',
    },
  ];

  it('resolves from venue address city', () => {
    expect(resolveMatchTerritory(match, teams, lookup)).toBe('Austin');
  });
});
