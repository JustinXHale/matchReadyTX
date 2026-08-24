import { describe, expect, it } from 'vitest';
import {
  cmoReportStats,
  globalCoachFeedbackStats,
  officialSeasonStats,
  reviewedOfficialInsightRows,
  gradePyramid,
  GRADE_TIER_ORDER,
  reportTrendByMonth,
  submittedCmoReports,
} from '@/domain/insights';
import type { CoachFeedback } from '@/domain/coachFeedback';
import type { MatchReport } from '@/domain/reports';
import type { Match, UserProfile } from '@/domain/types';
import { emptyCrew } from '@/domain/types';

function baseCoach(
  overrides: Partial<CoachFeedback> = {},
): CoachFeedback {
  return {
    id: 'm1_team',
    orgId: 'lonestar',
    matchId: 'm1',
    slot: 'mo',
    officialUserId: 'u1',
    officialName: 'Ref One',
    homeTeamId: 'h',
    homeTeamName: 'Home',
    awayTeamId: 'a',
    awayTeamName: 'Away',
    kickoffAt: '2026-01-01T15:00:00.000Z',
    level: 'Tier 1',
    score: '',
    scales: { overall: 4 },
    submitterUserId: 'ta1',
    submitterName: 'Coach',
    submitterEmail: 'c@x.com',
    clubRole: 'Coach',
    reportingTeamId: 'h',
    reportingTeamName: 'Home',
    status: 'submitted',
    createdAt: '2026-01-02',
    updatedAt: '2026-01-02',
    edits: [],
    ...overrides,
  };
}

describe('insights', () => {
  it('aggregates global coach feedback averages', () => {
    const stats = globalCoachFeedbackStats([
      baseCoach({ scales: { overall: 4, breakdown: 5 } }),
      baseCoach({
        id: 'm2_team',
        matchId: 'm2',
        scales: { overall: 2 },
        status: 'draft',
      }),
    ]);
    expect(stats.submittedCount).toBe(1);
    expect(stats.globalAverage).toBe(4.5);
  });

  it('buckets officials into grade pyramid tiers', () => {
    const users: UserProfile[] = [
      {
        uid: 'u1',
        firstName: 'A',
        lastName: 'B',
        displayName: 'A B',
        email: 'a@x.com',
        phone: '1',
        smsOptIn: false,
        homeStreet: '1',
        homeCity: 'A',
        homeRegion: 'TX',
        homePostalCode: '1',
        homeAddress: '1',
        roles: ['official'],
        teamIds: [],
        profileComplete: true,
        assessedLevel: 8,
      },
      {
        uid: 'u2',
        firstName: 'C',
        lastName: 'D',
        displayName: 'C D',
        email: 'c@x.com',
        phone: '2',
        smsOptIn: false,
        homeStreet: '2',
        homeCity: 'A',
        homeRegion: 'TX',
        homePostalCode: '2',
        homeAddress: '2',
        roles: ['official'],
        teamIds: [],
        profileComplete: true,
        refereeLevel: 6,
      },
    ];
    const pyramid = gradePyramid(users, [], []);
    expect(pyramid.map((t) => t.level)).toEqual([...GRADE_TIER_ORDER]);
    const tier8 = pyramid.find((t) => t.level === 8);
    const tier6 = pyramid.find((t) => t.level === 6);
    expect(tier8?.officialCount).toBe(1);
    expect(tier6?.officialCount).toBe(1);
  });

  it('averages CMO assessed ratings', () => {
    const reports: MatchReport[] = [
      {
        id: 'r1',
        matchId: 'm1',
        officialId: 'cmo1',
        slot: 'cmo',
        status: 'submitted',
        dueAt: '2026-01-01',
        kickoffAt: '2026-01-01',
        cmoPayload: { scales: {}, comments: {}, assessedRating: 8 },
      },
      {
        id: 'r2',
        matchId: 'm2',
        officialId: 'cmo1',
        slot: 'cmo',
        status: 'submitted',
        dueAt: '2026-01-02',
        kickoffAt: '2026-01-02',
        cmoPayload: { scales: {}, comments: {}, assessedRating: 6 },
      },
    ];
    expect(cmoReportStats(reports)).toEqual({
      submittedCount: 2,
      globalAverage: 7,
    });
  });

  it('builds monthly report trend buckets', () => {
    const now = new Date();
    const y = now.getUTCFullYear();
    const m = String(now.getUTCMonth() + 1).padStart(2, '0');
    const monthKey = `${y}-${m}`;
    const iso = now.toISOString();
    const trend = reportTrendByMonth(
      [
        baseCoach({
          updatedAt: iso,
          createdAt: iso,
        }),
      ],
      [
        {
          id: 'r1',
          matchId: 'm1',
          officialId: 'cmo1',
          slot: 'cmo',
          status: 'submitted',
          dueAt: iso,
          kickoffAt: iso,
          submittedAt: iso,
        },
      ],
      6,
    );
    expect(trend.length).toBe(6);
    const bucket = trend.find((b) => b.monthKey === monthKey);
    expect(bucket?.coachCount).toBe(1);
    expect(bucket?.cmoCount).toBe(1);
  });

  it('lists only officials with coach or CMO feedback', () => {
    const users: UserProfile[] = [
      {
        uid: 'u1',
        firstName: 'A',
        lastName: 'B',
        displayName: 'A B',
        email: 'a@x.com',
        phone: '1',
        smsOptIn: false,
        homeStreet: '1',
        homeCity: 'A',
        homeRegion: 'TX',
        homePostalCode: '1',
        homeAddress: '1',
        roles: ['official'],
        teamIds: [],
        profileComplete: true,
        assessedLevel: 8,
      },
      {
        uid: 'u2',
        firstName: 'C',
        lastName: 'D',
        displayName: 'C D',
        email: 'c@x.com',
        phone: '2',
        smsOptIn: false,
        homeStreet: '2',
        homeCity: 'A',
        homeRegion: 'TX',
        homePostalCode: '2',
        homeAddress: '2',
        roles: ['official'],
        teamIds: [],
        profileComplete: true,
        refereeLevel: 6,
      },
    ];
    const reviewed = reviewedOfficialInsightRows(
      users,
      [baseCoach({ officialUserId: 'u1' })],
      [],
      [],
    );
    expect(reviewed).toHaveLength(1);
    expect(reviewed[0].userId).toBe('u1');
  });

  it('lists submitted CMO reports only', () => {
    const reports: MatchReport[] = [
      {
        id: 'r1',
        matchId: 'm1',
        officialId: 'cmo1',
        slot: 'cmo',
        status: 'submitted',
        dueAt: '2026-01-01',
        kickoffAt: '2026-01-01',
        subjectOfficialId: 'mo1',
      },
      {
        id: 'r2',
        matchId: 'm2',
        officialId: 'cmo1',
        slot: 'cmo',
        status: 'pending',
        dueAt: '2026-01-01',
        kickoffAt: '2026-01-01',
      },
    ];
    expect(submittedCmoReports(reports)).toHaveLength(1);
  });

  it('aggregates official season stats from matches and reports', () => {
    const pastKickoff = '2025-06-01T15:00:00.000Z';
    const matches: Match[] = [
      {
        id: 'm1',
        sheetRowKey: 's1',
        status: 'team_confirmed',
        kickoffAt: pastKickoff,
        venueName: 'Field',
        venueAddress: 'Austin, TX',
        homeTeamId: 'h',
        awayTeamId: 'a',
        homeTeamName: 'Home',
        awayTeamName: 'Away',
        level: 'D1',
        gender: 'men',
        flightProvided: false,
        housingProvided: false,
        homeScore: 24,
        awayScore: 10,
        crew: {
          ...emptyCrew(),
          mo: [
            {
              id: 'mo1',
              slot: 'mo',
              userId: 'ref1',
              userName: 'Ref',
              status: 'confirmed',
              history: [],
            },
          ],
        },
      },
    ];
    const matchReports: MatchReport[] = [
      {
        id: 'mo1',
        matchId: 'm1',
        officialId: 'ref1',
        slot: 'mo',
        status: 'submitted',
        dueAt: pastKickoff,
        kickoffAt: pastKickoff,
        moPayload: {
          homePoints: 24,
          awayPoints: 10,
          yellowCards: 2,
          redCards: 0,
        },
      },
      {
        id: 'cmo1',
        matchId: 'm1',
        officialId: 'cmo1',
        slot: 'cmo',
        status: 'submitted',
        dueAt: pastKickoff,
        kickoffAt: pastKickoff,
        subjectOfficialId: 'ref1',
        cmoPayload: { scales: {}, comments: {}, assessedRating: 4 },
      },
    ];
    const coachFeedback: CoachFeedback[] = [
      baseCoach({
        officialUserId: 'ref1',
        scales: { overall: 5 },
      }),
    ];
    const stats = officialSeasonStats(
      'ref1',
      matches,
      matchReports,
      [],
      coachFeedback,
    );
    expect(stats.gamesPast).toBe(1);
    expect(stats.gamesMo).toBe(1);
    expect(stats.moReportsSubmitted).toBe(1);
    expect(stats.yellowCards).toBe(2);
    expect(stats.avgScoreMargin).toBe(14);
    expect(stats.coachFeedbackCount).toBe(1);
    expect(stats.cmoReportsReceived).toBe(1);
    expect(stats.cmoRatingAvg).toBe(4);
  });
});
