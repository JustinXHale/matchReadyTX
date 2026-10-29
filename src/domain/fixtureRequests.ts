import {
  emptyCrew,
  type FixtureRequest,
  type Match,
} from '@/domain/types';

/** Opponent not in the org roster — name stored on home/away team fields. */
export const OTHER_OPPONENT_TEAM_ID = '__other__';

export function isOtherOpponentTeamId(teamId: string): boolean {
  return teamId === OTHER_OPPONENT_TEAM_ID;
}

export type MatchCreateFacts = {
  homeTeamId: string;
  awayTeamId: string;
  homeTeamName: string;
  awayTeamName: string;
  kickoffAt: string;
  venueName: string;
  venueAddress: string;
  competition?: string;
  level: string;
  gender: Match['gender'];
  notes?: string;
  flightProvided: boolean;
  housingProvided: boolean;
  /** Pre-confirm one side (fixture approve). Omit for assigner add. */
  preConfirmSide?: 'home' | 'away';
};

/** Build a released pending_team_review match from schedule facts. */
export function matchFromCreateFacts(
  facts: MatchCreateFacts,
  opts: {
    matchId: string;
    sheetRowKey: string;
    at?: string;
  },
): Match {
  const at = opts.at ?? new Date().toISOString();
  return {
    id: opts.matchId,
    sheetRowKey: opts.sheetRowKey,
    status: 'pending_team_review',
    kickoffAt: facts.kickoffAt,
    venueName: facts.venueName,
    venueAddress: facts.venueAddress,
    homeTeamId: facts.homeTeamId,
    awayTeamId: facts.awayTeamId,
    homeTeamName: facts.homeTeamName,
    awayTeamName: facts.awayTeamName,
    competition: facts.competition,
    level: facts.level,
    gender: facts.gender,
    notes: facts.notes,
    flightProvided: facts.flightProvided,
    housingProvided: facts.housingProvided,
    crew: emptyCrew(),
    rolesNeeded: ['mo'],
    releasedAt: at,
    homeConfirmedAt: facts.preConfirmSide === 'home' ? at : undefined,
    awayConfirmedAt: facts.preConfirmSide === 'away' ? at : undefined,
  };
}

/** Build a released match from an approved fixture request (requester side pre-confirmed). */
export function matchFromFixtureRequest(
  req: FixtureRequest,
  opts: {
    matchId: string;
    sheetRowKey: string;
    at?: string;
  },
): Match {
  return matchFromCreateFacts(
    {
      homeTeamId: req.homeTeamId,
      awayTeamId: req.awayTeamId,
      homeTeamName: req.homeTeamName,
      awayTeamName: req.awayTeamName,
      kickoffAt: req.kickoffAt,
      venueName: req.venueName,
      venueAddress: req.venueAddress,
      competition: req.competition,
      level: req.level,
      gender: req.gender,
      notes: req.notes,
      flightProvided: req.flightProvided,
      housingProvided: req.housingProvided,
      preConfirmSide: req.side,
    },
    opts,
  );
}

/** Generate APP-{yyyyMMdd}-{short} match / sheet ids. */
export function newAppMatchId(now = new Date()): {
  matchId: string;
  sheetRowKey: string;
} {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const short = Math.random().toString(36).slice(2, 8).toUpperCase();
  const key = `APP-${y}${m}${d}-${short}`;
  return { matchId: key, sheetRowKey: key };
}
