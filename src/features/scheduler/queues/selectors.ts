import {
  crewPeople,
  type ChangeProposal,
  type FixtureRequest,
  type GameRequest,
  type Match,
} from '@/domain/types';
import type { AppState } from '@/services/demoStore';

/** Released matches still missing Match Official (not already in reassignment). */
export function matchesNeedingOfficials(matches: Match[]): Match[] {
  return matches.filter((m) => {
    if (
      m.status === 'draft' ||
      m.status === 'cancelled' ||
      m.status === 'postponed' ||
      m.status === 'needs_reassignment'
    ) {
      return false;
    }
    if (!m.releasedAt) return false;
    return crewPeople(m.crew.mo).length === 0;
  });
}

export function matchesNeedingReassignment(matches: Match[]): Match[] {
  return matches.filter((m) => m.status === 'needs_reassignment');
}

export function matchesT72Due(matches: Match[]): Match[] {
  return matches.filter(
    (m) =>
      m.status === 't72_team_pending' || m.status === 't72_officials_pending',
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
  /** Sum of actionable queues (excludes notifications). */
  totalActionable: number;
};

export function countSchedulerQueues(state: AppState): SchedulerQueueCounts {
  const fixtureRequests = pendingFixtureRequests(state.fixtureRequests).length;
  const teamLinkRequests = pendingTeamLinkRequests(
    state.teamLinkRequests,
  ).length;
  const raiseHand = pendingRaiseHandRequests(state.requests).length;
  const needsOfficials = matchesNeedingOfficials(state.matches).length;
  const needsReassignment = matchesNeedingReassignment(state.matches).length;
  const proposals = proposalsAwaitingAck(state.proposals).length;
  const t72 = matchesT72Due(state.matches).length;
  const notifications = state.notifications.length;
  return {
    fixtureRequests,
    teamLinkRequests,
    raiseHand,
    needsOfficials,
    needsReassignment,
    proposals,
    t72,
    notifications,
    totalActionable:
      fixtureRequests +
      teamLinkRequests +
      raiseHand +
      needsOfficials +
      needsReassignment +
      proposals +
      t72,
  };
}
