import type { Match, MatchStatus } from './types';
import {
  CREW_SLOTS,
  bothTeamsConfirmed,
  crewPeople,
  isCrewVisibleToTeams,
} from './types';

/** Pure match status transitions */

export function releaseMatch(match: Match, at = new Date().toISOString()): Match {
  if (match.status !== 'draft' && match.status !== 'cancelled') {
    return match;
  }
  return {
    ...match,
    status: 'pending_team_review',
    releasedAt: at,
    homeConfirmedAt: undefined,
    awayConfirmedAt: undefined,
  };
}

export function confirmTeam(
  match: Match,
  side: 'home' | 'away',
  at = new Date().toISOString(),
): Match {
  const next: Match = {
    ...match,
    homeConfirmedAt: side === 'home' ? at : match.homeConfirmedAt,
    awayConfirmedAt: side === 'away' ? at : match.awayConfirmedAt,
  };
  if (bothTeamsConfirmed(next)) {
    const hasOfficialCrew = CREW_SLOTS.some((s) =>
      crewPeople(next.crew[s]).some(
        (a) =>
          a.status === 'pending_internal' ||
          a.status === 'official' ||
          a.status === 'confirmed',
      ),
    );
    const crew = { ...next.crew };
    for (const slot of CREW_SLOTS) {
      crew[slot] = (crew[slot] ?? []).map((a) =>
        a.status === 'pending_internal' && a.userId
          ? { ...a, status: 'official' as const }
          : a,
      );
    }
    return {
      ...next,
      crew,
      status:
        hasOfficialCrew || crewPeople(crew.mo).length > 0
          ? 'crew_pending'
          : 'team_confirmed',
    };
  }
  return { ...next, status: 'pending_team_review' };
}

/** Mark or clear a team's confirmation of match details (e.g. MO after email). */
export function setTeamDetailsConfirmed(
  match: Match,
  side: 'home' | 'away',
  confirmed: boolean,
  at = new Date().toISOString(),
): Match {
  if (confirmed) return confirmTeam(match, side, at);
  if (
    match.status === 'cancelled' ||
    match.status === 'postponed' ||
    match.status === 'locked_confirmed'
  ) {
    return {
      ...match,
      homeConfirmedAt: side === 'home' ? undefined : match.homeConfirmedAt,
      awayConfirmedAt: side === 'away' ? undefined : match.awayConfirmedAt,
    };
  }
  const next: Match = {
    ...match,
    homeConfirmedAt: side === 'home' ? undefined : match.homeConfirmedAt,
    awayConfirmedAt: side === 'away' ? undefined : match.awayConfirmedAt,
  };
  if (!bothTeamsConfirmed(next)) {
    return { ...next, status: 'pending_team_review' };
  }
  return next;
}

function holdCrewAssignments(match: Match): Match['crew'] {
  const crew = { ...match.crew };
  for (const slot of CREW_SLOTS) {
    crew[slot] = (crew[slot] ?? []).map((a) => {
      if (
        a.status === 'confirmed' ||
        a.status === 'official' ||
        a.status === 'held'
      ) {
        return { ...a, status: 'held' as const, confirmedAt: undefined };
      }
      return a;
    });
  }
  return crew;
}

export function markNeedsReconfirmation(match: Match): Match {
  return {
    ...match,
    status: 'needs_reconfirmation',
    homeConfirmedAt: undefined,
    awayConfirmedAt: undefined,
    crew: holdCrewAssignments(match),
  };
}

/** Either team proposed a schedule change — clear confirms and hold crew. */
export function beginChangeProposed(match: Match): Match {
  return {
    ...match,
    status: 'change_proposed',
    homeConfirmedAt: undefined,
    awayConfirmedAt: undefined,
    crew: holdCrewAssignments(match),
  };
}

export function applySheetFacts(
  match: Match,
  facts: { kickoffAt?: string; venueName?: string; venueAddress?: string },
): Match {
  const changed =
    (facts.kickoffAt && facts.kickoffAt !== match.kickoffAt) ||
    (facts.venueName && facts.venueName !== match.venueName) ||
    (facts.venueAddress && facts.venueAddress !== match.venueAddress);

  const updated = {
    ...match,
    kickoffAt: facts.kickoffAt ?? match.kickoffAt,
    venueName: facts.venueName ?? match.venueName,
    venueAddress: facts.venueAddress ?? match.venueAddress,
  };

  if (!changed || match.status === 'draft') return updated;
  return markNeedsReconfirmation(updated);
}

export function cancelMatch(match: Match, at = new Date().toISOString()): Match {
  return { ...match, status: 'cancelled', cancelledAt: at };
}

export function postponeMatch(match: Match, at = new Date().toISOString()): Match {
  const held = markNeedsReconfirmation(match);
  return { ...held, status: 'postponed', postponedAt: at };
}

/** Best-effort workflow status from confirmations + crew (e.g. after accidental cancel). */
export function inferWorkflowStatus(match: Match): MatchStatus {
  if (!match.releasedAt) return 'draft';
  if (!bothTeamsConfirmed(match)) return 'pending_team_review';

  const hasNamedCrew = CREW_SLOTS.some((s) =>
    crewPeople(match.crew[s]).some(
      (a) =>
        a.status === 'pending_internal' ||
        a.status === 'official' ||
        a.status === 'confirmed' ||
        a.status === 'held',
    ),
  );
  const moPeople = crewPeople(match.crew.mo);
  if (moPeople.length === 0) {
    return hasNamedCrew ? 'needs_reassignment' : 'team_confirmed';
  }

  const allFilledConfirmed = CREW_SLOTS.every((s) =>
    crewPeople(match.crew[s]).every((a) => a.status === 'confirmed'),
  );
  if (
    allFilledConfirmed &&
    isCrewVisibleToTeams({ ...match, status: 'crew_confirmed' })
  ) {
    return 'crew_confirmed';
  }
  if (moPeople.some((a) => a.status === 'confirmed')) return 'mo_confirmed';
  if (hasNamedCrew) return 'crew_pending';
  return 'team_confirmed';
}

/** Undo cancel/postpone — postponed matches return to needs_reconfirmation. */
export function reactivateMatch(match: Match): Match {
  if (match.status !== 'cancelled' && match.status !== 'postponed') {
    return match;
  }
  if (match.status === 'postponed') {
    return {
      ...match,
      status: 'needs_reconfirmation',
      cancelledAt: undefined,
      postponedAt: undefined,
    };
  }
  return {
    ...match,
    status: inferWorkflowStatus(match),
    cancelledAt: undefined,
    postponedAt: undefined,
  };
}

export function enterT72(match: Match): Match {
  if (
    match.status === 'mo_confirmed' ||
    match.status === 'crew_confirmed' ||
    match.status === 'locked_confirmed'
  ) {
    return { ...match, status: 't72_team_pending' };
  }
  return match;
}

export function applyT72Team(
  match: Match,
  side: 'home' | 'away',
  answer: 'yes' | 'no',
): Match {
  const next: Match = {
    ...match,
    t72TeamHome: side === 'home' ? answer : match.t72TeamHome,
    t72TeamAway: side === 'away' ? answer : match.t72TeamAway,
  };
  if (answer === 'no') {
    return cancelMatch(next);
  }
  if (next.t72TeamHome === 'yes' && next.t72TeamAway === 'yes') {
    return { ...next, status: 't72_officials_pending' };
  }
  return { ...next, status: 't72_team_pending' };
}

export function statusLabel(status: MatchStatus): string {
  const map: Record<MatchStatus, string> = {
    draft: 'Draft',
    pending_team_review: 'Needs team confirm',
    change_proposed: 'Change Proposed',
    team_confirmed: 'Teams confirmed',
    crew_pending: 'Awaiting officials',
    mo_confirmed: 'MO confirmed',
    crew_confirmed: 'Crew confirmed',
    t72_team_pending: 'T-72 teams',
    t72_officials_pending: 'T-72 officials',
    locked_confirmed: 'Locked in',
    needs_reconfirmation: 'Needs reconfirm',
    needs_reassignment: 'Needs reassignment',
    cancelled: 'Cancelled',
    postponed: 'Postponed',
  };
  return map[status];
}
