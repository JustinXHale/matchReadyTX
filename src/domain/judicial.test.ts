import { describe, expect, it } from 'vitest';
import { trendBucketForLaws, disciplineTrendLabelWithLaws } from '@/domain/cardLaws';
import {
  casesFromCardReport,
  casePlayerNameFromParts,
  defaultCaseStatus,
  disciplineDashboardStats,
  displayCasePlayer,
  filterCasesForDashboard,
  filterJudicialCases,
  normalizePlayerTraceName,
  playerTraceKey,
  rugbySeasonDateRange,
  rulingNeedsSanction,
} from '@/domain/judicial';
import { judicialCasesToCsv } from '@/domain/judicialExport';
import {
  cardIncidentsForSubmit,
  displayPlayerName,
  isCompleteCardIncident,
  validateCardReportIdentity,
  validateCardReportIncidents,
  type CardIncident,
  type CardReport,
} from '@/domain/reports';
import {
  displayCompetitionLabel,
  competitionsEqual,
  uniqueDisplayedCompetitions,
} from '@/domain/competitions';
import { seedDemoMenJudicialCases } from '@/services/demoJudicialSeason';
import { lensesForUser } from '@/app/AppContext';
import type { UserProfile } from '@/domain/types';

function baseReport(): CardReport {
  return {
    id: 'r1',
    matchId: 'm1',
    officialId: 'u1',
    status: 'submitted',
    competitionUnion: 'ncr_lonestar_college',
    conference: 'lonestar_men',
    officialName: 'Ref',
    officialEmail: 'r@x.com',
    officialPhone: '1',
    matchDate: '2026-08-29',
    cards: [
      {
        id: 'c1',
        color: 'yellow',
        playerName: 'A Player',
        playerFirstName: 'A',
        playerLastName: 'Player',
        teamId: 't1',
        teamName: 'SHSU',
        reason: 'Repeat',
        lawIds: ['law_9_8_9_10_repeated'],
        offenseSummary: 'Team repeat',
      },
      {
        id: 'c2',
        color: 'red',
        playerName: 'B Player',
        playerFirstName: 'B',
        playerLastName: 'Player',
        teamId: 't2',
        teamName: 'UNT',
        reason: 'High tackle',
        lawIds: ['law_9_13_dangerous_tackling'],
        offenseSummary: 'High tackle',
      },
    ],
    createdAt: '2026-08-29T12:00:00.000Z',
    submittedAt: '2026-08-29T12:00:00.000Z',
  };
}

describe('card laws → trend buckets', () => {
  it('maps dangerous tackling to head-contact bucket', () => {
    expect(trendBucketForLaws(['law_9_13_dangerous_tackling'])).toBe(
      'dangerous_tackles',
    );
  });
  it('maps repeated infringement', () => {
    expect(trendBucketForLaws(['law_9_8_9_10_repeated'])).toBe(
      'repeated_infringements',
    );
  });
});

describe('judicial cases from card reports', () => {
  it('defaults yellow to recorded and red to pending', () => {
    expect(defaultCaseStatus('yellow')).toBe('recorded');
    expect(defaultCaseStatus('red')).toBe('pending');
    expect(defaultCaseStatus('second_yellow_red')).toBe('pending');
    const cases = casesFromCardReport(baseReport());
    expect(cases).toHaveLength(2);
    expect(cases[0]?.status).toBe('recorded');
    expect(cases[1]?.status).toBe('pending');
  });

  it('creates a second case for a second offense', () => {
    const report = baseReport();
    report.cards[0]!.receivedAnotherCard = true;
    report.cards[0]!.secondOffense = {
      color: 'second_yellow_red',
      approximateTime: '70',
      lawIds: ['law_9_7_unfair_play'],
      summary: 'Cynical knock-on',
    };
    const cases = casesFromCardReport(report);
    expect(cases).toHaveLength(3);
    expect(cases.some((c) => c.color === 'second_yellow_red')).toBe(true);
  });

  it('copies jersey onto judicial case snapshot', () => {
    const report = baseReport();
    report.cards[0]!.playerJersey = '10';
    report.cards[0]!.playerFirstName = '';
    report.cards[0]!.playerLastName = '';
    report.cards[0]!.playerName = '';
    const cases = casesFromCardReport(report);
    expect(cases[0]?.playerJersey).toBe('10');
    expect(cases[0]?.playerName).toBe('#10');
    expect(displayCasePlayer(cases[0]!)).toBe('#10');
  });
});

describe('discipline dashboard stats', () => {
  it('counts yellow/red and school bars with stacked counts', () => {
    const cases = casesFromCardReport(baseReport()).map((c) =>
      c.color === 'red'
        ? { ...c, status: 'upheld' as const, sanctionMatches: 2 }
        : c,
    );
    const stats = disciplineDashboardStats(cases);
    expect(stats.totalCards).toBe(2);
    expect(stats.yellowCards).toBe(1);
    expect(stats.redCards).toBe(1);
    expect(stats.redsUpheld).toBe(1);
    expect(stats.bySchool).toHaveLength(2);
    const shsu = stats.bySchool.find((s) => s.teamName === 'SHSU');
    expect(shsu?.yellowCount).toBe(1);
    expect(shsu?.redCount).toBe(0);
    expect(
      filterCasesForDashboard(cases, 'lonestar_women'),
    ).toHaveLength(0);
    expect(filterCasesForDashboard(cases, 'lonestar_men')).toHaveLength(2);
  });

  it('sorts schools by count descending and tracks pending reds', () => {
    const cases = seedDemoMenJudicialCases();
    const stats = disciplineDashboardStats(cases);
    expect(stats.bySchool[0]?.teamName).toBe('SHSU');
    expect(stats.bySchool[0]?.count).toBe(13);
    expect(stats.byPlayer.length).toBeGreaterThan(0);
    for (const row of stats.bySchool) {
      expect(row.yellowCount + row.redCount).toBe(row.count);
    }
    const pending = cases.filter(
      (c) => c.color !== 'yellow' && c.status === 'pending',
    );
    expect(stats.pendingReds).toHaveLength(pending.length);
  });
});

describe('discipline trend labels', () => {
  it('prefixes bucket labels with law numbers', () => {
    expect(disciplineTrendLabelWithLaws('dangerous_tackles')).toMatch(/^9\./);
    expect(disciplineTrendLabelWithLaws('dangerous_tackles')).toContain(
      'Dangerous tackles',
    );
  });
});

describe('Lonestar copy', () => {
  it('rewrites Lone Star for display and treats aliases as equal', () => {
    expect(displayCompetitionLabel('Lone Star Men')).toBe('Lonestar Men');
    expect(displayCompetitionLabel('Lonestar Men')).toBe('Lonestar Men');
    expect(competitionsEqual('Lonestar Women', 'Lone Star Women')).toBe(true);
    expect(competitionsEqual('Lonestar Men', 'Lone Star Women')).toBe(false);
  });
});

describe('judicial lens', () => {
  const user: UserProfile = {
    uid: 'u',
    firstName: 'J',
    lastName: 'O',
    displayName: 'J O',
    email: 'j@x.com',
    phone: '1',
    smsOptIn: false,
    homeStreet: '',
    homeCity: '',
    homeRegion: '',
    homePostalCode: '',
    homeAddress: '',
    roles: ['judicial'],
    teamIds: [],
    profileComplete: true,
  };

  it('lensesForUser includes judicial', () => {
    expect(lensesForUser(user)).toEqual(['judicial']);
    expect(
      lensesForUser({ ...user, roles: ['assigner', 'judicial'] }),
    ).toEqual(['scheduler', 'finance', 'judicial']);
  });
});

describe('card report form validation', () => {
  const identity = {
    officialName: 'Alex Assigner',
    officialEmail: 'a@x.com',
    officialPhone: '555',
    competitionUnion: 'ncr_lonestar_college' as const,
    conference: '' as const,
    matchDate: '2026-08-29',
  };

  it('requires Lonestar Men or Women when the college union is selected', () => {
    expect(validateCardReportIdentity(identity)).toBe(
      'Select Lonestar Men or Lonestar Women.',
    );
    expect(
      validateCardReportIdentity({ ...identity, conference: 'lonestar_men' }),
    ).toBeNull();
  });

  it('requires filmed, laws, summary, and a complete second-offense block', () => {
    const incomplete: CardIncident = {
      id: 'c1',
      color: 'yellow',
      playerName: '',
      playerFirstName: 'Jane',
      playerLastName: 'Doe',
      teamId: 't1',
      teamName: 'SHSU',
      reason: '',
      lawIds: ['law_9_13_dangerous_tackling'],
      offenseSummary: 'High tackle',
      receivedAnotherCard: true,
      secondOffense: {
        color: 'second_yellow_red',
        approximateTime: '70',
        lawIds: [],
        summary: '',
      },
    };
    expect(validateCardReportIncidents([incomplete], null)).toMatch(/filmed/);
    expect(validateCardReportIncidents([incomplete], true)).toMatch(
      /Second offense/,
    );
    const complete = {
      ...incomplete,
      secondOffense: {
        color: 'second_yellow_red' as const,
        approximateTime: '70',
        lawIds: ['law_9_7_unfair_play' as const],
        summary: 'Cynical knock-on',
      },
    };
    expect(validateCardReportIncidents([complete], false)).toBeNull();
    const submitted = cardIncidentsForSubmit([complete]);
    expect(submitted).toHaveLength(1);
    expect(submitted[0]?.playerName).toBe('Jane Doe');
    expect(submitted[0]?.secondOffense?.color).toBe('second_yellow_red');
    expect(submitted[0]?.lawIds).toEqual(['law_9_13_dangerous_tackling']);
  });

  it('accepts jersey-only cards when laws and summary are present', () => {
    const jerseyOnly: CardIncident = {
      id: 'c9',
      color: 'yellow',
      playerName: '',
      teamId: 't1',
      teamName: 'SHSU',
      playerJersey: '10',
      reason: '',
      lawIds: ['law_9_13_dangerous_tackling'],
      offenseSummary: 'High tackle',
    };
    expect(isCompleteCardIncident(jerseyOnly)).toBe(true);
    expect(displayPlayerName(jerseyOnly)).toBe('#10');
    expect(validateCardReportIncidents([jerseyOnly], false)).toBeNull();
    const submitted = cardIncidentsForSubmit([jerseyOnly]);
    expect(submitted[0]?.playerJersey).toBe('10');
    expect(submitted[0]?.playerName).toBe('#10');
  });
});

describe('dashboard stats selectors', () => {
  it('aggregates KPIs and school breakdowns', () => {
    const cases = casesFromCardReport(baseReport()).map((c) =>
      c.color === 'red'
        ? { ...c, status: 'upheld' as const, sanctionMatches: 2 }
        : c,
    );
    const stats = disciplineDashboardStats(cases);
    expect(stats.totalCards).toBe(2);
    expect(stats.bySchool.map((s) => s.teamName).sort()).toEqual(['SHSU', 'UNT']);
    expect(rulingNeedsSanction('upheld')).toBe(true);
    expect(rulingNeedsSanction('dismissed')).toBe(false);
  });
});

describe('demo Board season (Men)', () => {
  it('matches the 59 / 49 / 10 / 7 / 3 one-pager KPIs with SHSU on top', () => {
    const cases = seedDemoMenJudicialCases();
    const stats = disciplineDashboardStats(cases);
    expect(cases).toHaveLength(59);
    expect(stats.totalCards).toBe(59);
    expect(stats.yellowCards).toBe(49);
    expect(stats.redCards).toBe(10);
    expect(stats.redsUpheld).toBe(7);
    expect(stats.redsDismissed).toBe(3);
    expect(stats.bySchool).toHaveLength(17);
    expect(stats.bySchool[0]?.teamName).toBe('SHSU');
    expect(stats.bySchool[0]?.count).toBe(13);
    expect(stats.dismissedReds.map((c) => c.playerLastName).sort()).toEqual([
      'Balcazar',
      'Creacy',
      'Goeddertz',
    ]);
  });

  it('filters by date range and snapshots the issuing official', () => {
    const cases = seedDemoMenJudicialCases();
    expect(cases.every((c) => c.officialName)).toBe(true);
    expect(cases.every((c) => c.matchDate)).toBe(true);
    const none = filterJudicialCases(cases, {
      from: '2010-01-01',
      to: '2010-12-31',
    });
    expect(none).toHaveLength(0);
    const season = rugbySeasonDateRange(new Date('2026-08-29T12:00:00Z'));
    const inSeason = filterJudicialCases(cases, {
      from: season.from,
      to: season.to,
    });
    expect(inSeason.length).toBe(59);
  });
});

describe('displayed conference aliases', () => {
  it('dedupes Lonestar / Lone Star in filter lists', () => {
    expect(
      uniqueDisplayedCompetitions(['Lonestar Men', 'Lone Star Men', 'Club']),
    ).toEqual(['Club', 'Lonestar Men']);
  });
});

describe('player tracing and export', () => {
  it('builds trace keys and filters by team + player name', () => {
    const cases = casesFromCardReport(baseReport());
    const shsu = cases[0]!;
    expect(playerTraceKey(shsu)).toBe(
      `shsu|${normalizePlayerTraceName('A Player')}`,
    );
    const traced = filterJudicialCases(cases, {
      school: 'SHSU',
      player: 'A Player',
    });
    expect(traced).toHaveLength(1);
    expect(traced[0]?.id).toBe(shsu.id);
  });

  it('exports corrected player identity and jersey to csv', () => {
    const report = baseReport();
    report.cards[0]!.playerJersey = '7';
    const [c] = casesFromCardReport(report);
    const corrected = {
      ...c!,
      ...casePlayerNameFromParts('Alex', 'Rivera', '7'),
      playerJersey: '7',
    };
    const csv = judicialCasesToCsv([corrected]);
    expect(csv).toContain('Alex');
    expect(csv).toContain('Rivera');
    expect(csv).toContain(',7,');
    expect(displayCasePlayer(corrected)).toBe('Alex Rivera');
  });
});
