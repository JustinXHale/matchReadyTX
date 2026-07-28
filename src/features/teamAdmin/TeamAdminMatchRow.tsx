import { Link } from 'react-router-dom';
import { MatchListRow } from '@/ui/MatchListRow';
import { MatchCrewTrailing } from '@/ui/MatchCrewTrailing';
import {
  isCrewVisibleToTeams,
  REQUESTABLE_SLOT_SHORT,
  rolesNeededForMatch,
  teamAdminListStatus,
  teamFacingCmoFill,
  teamFacingCrewRoleFill,
  type Match,
  type RequestableSlot,
} from '@/domain/types';
import { backState, type BackNav } from '@/nav/backNav';

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

function redactedFill(match: Match, slot: RequestableSlot): string {
  if (slot === 'cmo') return teamFacingCmoFill(match).fill;
  return teamFacingCrewRoleFill(match.crew[slot]).fill;
}

function redactedStatus(match: Match, slot: RequestableSlot): string {
  if (slot === 'cmo') return teamFacingCmoFill(match).status;
  return teamFacingCrewRoleFill(match.crew[slot]).status;
}

function pillClassForTone(tone: 'urgent' | 'warn' | 'none'): string {
  if (tone === 'urgent') return 'rs-pill rs-pill--urgent';
  if (tone === 'warn') return 'rs-pill rs-pill--warn';
  return 'rs-pill';
}

/** Crew column for teams before MO unlock — roles + fill, no names. */
function TeamAdminCrewPendingTrailing({
  match,
  back,
}: {
  match: Match;
  back: BackNav;
}) {
  const roles = rolesNeededForMatch(match);
  return (
    <Link
      to={`/matches/${match.id}`}
      state={backState(back)}
      className="rs-appt-crew rs-appt-crew-hit"
      aria-label="Open match crew status"
      onClick={(e) => e.stopPropagation()}
    >
      {roles.map((slot) => {
        const fill = redactedFill(match, slot);
        const status = redactedStatus(match, slot);
        const label = REQUESTABLE_SLOT_SHORT[slot];
        const detail =
          fill === 'Open'
            ? 'Open'
            : fill === 'Confirmed'
              ? 'Confirmed'
              : status === 'Awaiting confirmation'
                ? 'Pending'
                : fill;
        return (
          <p key={slot} className="rs-appt-crew__line">
            <span className="rs-appt-crew__slot">{label}</span> {detail}
          </p>
        );
      })}
    </Link>
  );
}

export function TeamAdminMatchRow({
  match,
  teamId,
  to,
  back,
  hasPendingProposal = false,
}: {
  match: Match;
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
        ) : crewVisible ? (
          <MatchCrewTrailing match={match} back={back} />
        ) : (
          <TeamAdminCrewPendingTrailing match={match} back={back} />
        )
      }
    />
  );
}
