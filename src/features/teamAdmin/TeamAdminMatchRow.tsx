import { MatchListRow } from '@/ui/MatchListRow';
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

function pillClassForTone(tone: 'urgent' | 'warn' | 'none'): string {
  if (tone === 'urgent') return 'rs-pill rs-pill--urgent';
  if (tone === 'warn') return 'rs-pill rs-pill--warn';
  return 'rs-pill';
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
    <MatchListRow
      match={match}
      to={to}
      showTime
      split="action"
      urgent={listStatus.tone === 'urgent'}
      warn={listStatus.tone === 'warn'}
      back={back}
      trailing={
        listStatus.label ? (
          <div className="rs-team-admin__status">
            <span
              className={`${pillClassForTone(listStatus.tone)}${
                listStatus.label === 'Change Proposed' ||
                listStatus.tone === 'warn'
                  ? ' rs-team-admin__status-pill--wrap'
                  : ''
              }`}
            >
              {listStatus.label === 'Change Proposed' ? (
                <>
                  Change
                  <br />
                  Proposed
                </>
              ) : listStatus.tone === 'warn' ? (
                <>
                  Waiting on
                  <br />
                  Referee Confirmation
                </>
              ) : (
                listStatus.label
              )}
            </span>
          </div>
        ) : (
          <MatchCrewTrailing
            match={match}
            back={back}
            redactNames={!crewVisible}
          />
        )
      }
    />
  );
}
