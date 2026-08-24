import type { Match } from '@/domain/types';
import { matchNeedsCrewCoverage } from '@/domain/requests';
import {
  type ChangeProposal,
  type FixtureRequest,
  type GameRequest,
  type MatchGender,
} from '@/domain/types';
import {
  fixtureMatchesDivisionFilters,
  matchMatchesDivisionFilters,
  sortByKickoffAsc,
} from '@/domain/divisionFilters';
import type { AppState } from '@/services/demoStore';

export { fixtureMatchesDivisionFilters, matchMatchesDivisionFilters };

export function proposalMatchesDivisionFilters(
  proposal: ChangeProposal,
  matches: Match[],
  genderFilter: MatchGender | null,
  levelFilter: string | null,
  competitionFilter: string | null = null,
): boolean {
  if (!genderFilter && !levelFilter && !competitionFilter) return true;
  const m = matches.find((x) => x.id === proposal.matchId);
  return (
    m != null &&
    matchMatchesDivisionFilters(
      m,
      genderFilter,
      levelFilter,
      competitionFilter,
    )
  );
}

/** Released matches still missing fee-crew officials (CMO excluded). */
export function matchesNeedingOfficials(matches: Match[]): Match[] {
  return sortByKickoffAsc(matches.filter((m) => {
    if (
      m.status === 'draft' ||
      m.status === 'cancelled' ||
      m.status === 'postponed' ||
      m.status === 'needs_reassignment'
    ) {
      return false;
    }
    if (!m.releasedAt) return false;
    return matchNeedsCrewCoverage(m);
  }));
}

export function matchesNeedingReassignment(matches: Match[]): Match[] {
  return sortByKickoffAsc(
    matches.filter((m) => m.status === 'needs_reassignment'),
  );
}

export function matchesT72Due(matches: Match[]): Match[] {
  return sortByKickoffAsc(
    matches.filter(
      (m) =>
        m.status === 't72_team_pending' || m.status === 't72_officials_pending',
    ),
  );
}

/** Assigner awareness queue — not a blocker on applying the change. */
export function proposalsAwaitingAck(
  proposals: ChangeProposal[],
): ChangeProposal[] {
  return proposals.filter(
    (p) =>
      !p.assignerAckAt &&
      (p.status === 'pending' || p.status === 'approved'),
  );
}

export function pendingRaiseHandRequests(
  requests: GameRequest[],
): GameRequest[] {
  return requests.filter((r) => r.status === 'pending');
}

export function gameRequestHasMatch(
  request: GameRequest,
  matches: Match[],
): boolean {
  return matches.some((m) => m.id === request.matchId);
}

export function proposalHasMatch(
  proposal: ChangeProposal,
  matches: Match[],
): boolean {
  return matches.some((m) => m.id === proposal.matchId);
}

/** Pending raise-hand rows whose match is still on the schedule. */
export function actionableRaiseHandRequests(
  requests: GameRequest[],
  matches: Match[],
): GameRequest[] {
  return pendingRaiseHandRequests(requests).filter((r) =>
    gameRequestHasMatch(r, matches),
  );
}

/** Proposals awaiting ack whose match is still on the schedule. */
export function actionableProposalsAwaitingAck(
  proposals: ChangeProposal[],
  matches: Match[],
): ChangeProposal[] {
  return proposalsAwaitingAck(proposals).filter((p) =>
    proposalHasMatch(p, matches),
  );
}

export function pendingFixtureRequests(
  requests: FixtureRequest[],
): FixtureRequest[] {
  return requests.filter((r) => r.status === 'pending');
}

export function pendingTeamLinkRequests(
  requests: AppState['teamLinkRequests'],
): AppState['teamLinkRequests'] {
  return requests.filter((r) => r.status === 'pending');
}

export type SchedulerQueueCounts = {
  fixtureRequests: number;
  teamLinkRequests: number;
  raiseHand: number;
  needsOfficials: number;
  needsReassignment: number;
  proposals: number;
  t72: number;
  notifications: number;
  /** Coverage + changes work queues (excludes inbound requests). */
  workActionable: number;
  /** Sum of actionable queues (excludes notifications). */
  totalActionable: number;
};

export function countSchedulerQueues(state: AppState): SchedulerQueueCounts {
  const fixtureRequests = pendingFixtureRequests(state.fixtureRequests).length;
  const teamLinkRequests = pendingTeamLinkRequests(
    state.teamLinkRequests,
  ).length;
  const raiseHand = actionableRaiseHandRequests(
    state.requests,
    state.matches,
  ).length;
  const needsOfficials = matchesNeedingOfficials(state.matches).length;
  const needsReassignment = matchesNeedingReassignment(state.matches).length;
  const proposals = actionableProposalsAwaitingAck(
    state.proposals,
    state.matches,
  ).length;
  const t72 = matchesT72Due(state.matches).length;
  const notifications = state.notifications.length;
  const workActionable =
    needsOfficials + needsReassignment + proposals + t72;
  return {
    fixtureRequests,
    teamLinkRequests,
    raiseHand,
    needsOfficials,
    needsReassignment,
    proposals,
    t72,
    notifications,
    workActionable,
    totalActionable:
      fixtureRequests + teamLinkRequests + raiseHand + workActionable,
  };
}
