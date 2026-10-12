import {
  MatchSummaryCard,
  type MatchCardStatusPresentation,
} from '@/components/MatchSummaryCard';
import { MatchCrewTrailing } from '@/ui/MatchCrewTrailing';
import {
  isCrewVisibleToTeams,
  teamAdminListStatus,
  type Match,
} from '@/domain/types';
import type { BackNav } from '@/nav/backNav';

/** Which side of the match belongs to this club team. */
export function myMatchSide(
  match: Match,
  teamId: string,
): 'home' | 'away' | null {
  if (match.homeTeamId === teamId) return 'home';
  if (match.awayTeamId === teamId) return 'away';
  return null;
}

export function sideConfirmedForTeam(match: Match, teamId: string): boolean {
  const side = myMatchSide(match, teamId);
  if (side === 'home') return Boolean(match.homeConfirmedAt);
  if (side === 'away') return Boolean(match.awayConfirmedAt);
  return false;
}

function statusPresentation(
  tone: 'urgent' | 'warn' | 'none',
  label: string | null,
): MatchCardStatusPresentation {
  if (tone === 'urgent') {
    return { tone: 'declined', label: label ?? 'Needs confirm' };
  }
  if (tone === 'warn') {
    return {
      tone: 'pending',
      label: label ?? 'Waiting on Referee Confirmation',
    };
  }
  return { tone: 'approved', label: 'Confirmed' };
}

export function TeamAdminMatchRow({
  match,
  to,
  back,
  hasPendingProposal = false,
}: {
  match: Match;
  /** Kept for call-site keys / future per-team row logic. */
  teamId: string;
  to: string;
  back: BackNav;
  hasPendingProposal?: boolean;
}) {
  const listStatus = teamAdminListStatus(match, hasPendingProposal);
  const crewVisible = isCrewVisibleToTeams(match);

  return (
    <MatchSummaryCard
      match={match}
      to={to}
      showTime
      back={back}
      statusPresentation={statusPresentation(
        listStatus.tone,
        listStatus.label,
      )}
      footer={
        <MatchCrewTrailing
          match={match}
          back={back}
          redactNames={!crewVisible}
        />
      }
    />
  );
}
