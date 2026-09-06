import { describe, expect, it } from 'vitest';
import {
  coachFeedbackDocId,
  coachFeedbackListRows,
  coachFeedbackScopeForMatch,
  tournamentGroupKeyFromMatch,
} from '@/domain/coachFeedback';
import { emptyAssignment, emptyCrew, type Match, type UserProfile } from '@/domain/types';

function pastMatch(partial: Partial<Match> & Pick<Match, 'id'>): Match {
  return {
    sheetRowKey: partial.id,
    status: 'locked_confirmed',
    kickoffAt: new Date(Date.now() - 86_400_000).toISOString(),
    venueName: 'Field',
    venueAddress: 'Austin, TX',
    homeTeamId: 'team_austin',
    awayTeamId: 'team_dallas',
    homeTeamName: 'Austin RFC',
    awayTeamName: 'Dallas RFC',
    level: 'D1',
    gender: 'men',
    flightProvided: false,
    housingProvided: false,
    crew: {
      ...emptyCrew(),
      mo: [
        {
          ...emptyAssignment('mo'),
          userId: 'u_mo',
          userName: 'MO Ref',
          status: 'confirmed',
        },
      ],
    },
    homeConfirmedAt: new Date().toISOString(),
    awayConfirmedAt: new Date().toISOString(),
    releasedAt: new Date().toISOString(),
    ...partial,
  };
}

const homeAdmin: UserProfile = {
  uid: 'u_home',
  firstName: 'Austin',
  lastName: 'Admin',
  displayName: 'Austin Admin',
  email: 'austin@example.com',
  phone: '555-0100',
  smsOptIn: false,
  homeStreet: '1 Main',
  homeCity: 'Austin',
  homeRegion: 'TX',
  homePostalCode: '78701',
  homeAddress: '1 Main, Austin, TX 78701',
  roles: ['teamAdmin'],
  teamIds: ['team_austin'],
  profileComplete: true,
};

describe('coachFeedback tournaments', () => {
  it('uses title slug for tournament group key', () => {
    const match = pastMatch({
      id: 'm1',
      title: 'Lonestar 7s — Austin',
      isTournament: true,
    });
    expect(tournamentGroupKeyFromMatch(match)).toBe('lonestar-7s-austin');
    expect(coachFeedbackScopeForMatch(match)).toBe('crew');
    expect(coachFeedbackDocId(match, 'team_austin')).toBe(
      'lonestar-7s-austin_team_austin',
    );
  });

  it('groups tournament matches into one list row for host team', () => {
    const shared = {
      title: 'Spring 7s',
      isTournament: true,
      homeTeamId: 'team_austin',
      awayTeamId: 'team_dallas',
    };
    const rows = coachFeedbackListRows(
      [
        pastMatch({
          id: 'm1',
          kickoffAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
          ...shared,
        }),
        pastMatch({
          id: 'm2',
          kickoffAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
          ...shared,
        }),
      ],
      homeAdmin,
      [],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.kind).toBe('crew');
  });

  it('keeps league feedback doc id per match', () => {
    const match = pastMatch({ id: 'm_league' });
    expect(coachFeedbackDocId(match, 'team_austin')).toBe('m_league_team_austin');
  });
});
