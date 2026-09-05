import { describe, expect, it } from 'vitest';
import { defaultFees } from '@/domain/economics';
import {
  feeInputFromTable,
  feeOverrideForMatch,
  feeTableFromInput,
  matchesForFeeApply,
} from '@/domain/feeDefaults';
import type { Match } from '@/domain/types';
import { emptyCrew } from '@/domain/types';

function match(partial: Partial<Match> & Pick<Match, 'id' | 'kickoffAt' | 'level'>): Match {
  return {
    sheetRowKey: partial.id,
    status: 'locked_confirmed',
    venueName: 'Field',
    venueAddress: 'Austin, TX',
    homeTeamId: 'h',
    awayTeamId: 'a',
    homeTeamName: 'Home',
    awayTeamName: 'Away',
    gender: 'men',
    flightProvided: false,
    housingProvided: false,
    crew: emptyCrew(),
    ...partial,
  };
}

describe('feeDefaults', () => {
  it('maps AR input to both assistant rates', () => {
    const table = feeTableFromInput({ mo: 100, ar: 45, no4: 30, cmo: 50 });
    expect(table.ar1).toBe(45);
    expect(table.ar2).toBe(45);
  });

  it('uses tourney table for tournament levels', () => {
    const league = defaultFees();
    const tourney = feeTableFromInput({ mo: 120, ar: 60, no4: 40, cmo: 80 });
    const d1 = feeOverrideForMatch(
      match({ id: 'm1', kickoffAt: '2026-09-01T14:00:00.000Z', level: 'D1' }),
      league,
      tourney,
    );
    const tr = feeOverrideForMatch(
      match({ id: 'm2', kickoffAt: '2026-09-01T14:00:00.000Z', level: 'Tourney' }),
      league,
      tourney,
    );
    expect(d1.mo).toBe(league.mo);
    expect(tr.mo).toBe(120);
  });

  it('filters matches by date range and skips drafts', () => {
    const rows = matchesForFeeApply(
      [
        match({
          id: 'in',
          kickoffAt: '2026-09-03T14:00:00.000Z',
          level: 'D1',
        }),
        match({
          id: 'out',
          kickoffAt: '2026-08-01T14:00:00.000Z',
          level: 'D1',
        }),
        match({
          id: 'draft',
          kickoffAt: '2026-09-04T14:00:00.000Z',
          level: 'D1',
          status: 'draft',
        }),
      ],
      { periodStart: '2026-09-01', periodEnd: '2026-09-30' },
    );
    expect(rows.map((r) => r.id)).toEqual(['in']);
  });

  it('round-trips fee input from table', () => {
    const table = defaultFees();
    expect(feeTableFromInput(feeInputFromTable(table))).toEqual(table);
  });
});
