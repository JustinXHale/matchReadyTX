import {
  emptyCrew,
  type FixtureRequest,
  type Match,
} from '@/domain/types';

/** Build a released match from an approved fixture request (requester side pre-confirmed). */
export function matchFromFixtureRequest(
  req: FixtureRequest,
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
    kickoffAt: req.kickoffAt,
    venueName: req.venueName,
    venueAddress: req.venueAddress,
    homeTeamId: req.homeTeamId,
    awayTeamId: req.awayTeamId,
    homeTeamName: req.homeTeamName,
    awayTeamName: req.awayTeamName,
    competition: req.competition,
    level: req.level,
    gender: req.gender,
    notes: req.notes,
    flightProvided: req.flightProvided,
    housingProvided: req.housingProvided,
    crew: emptyCrew(),
    rolesNeeded: ['mo'],
    releasedAt: at,
    homeConfirmedAt: req.side === 'home' ? at : undefined,
    awayConfirmedAt: req.side === 'away' ? at : undefined,
  };
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
