import { Link } from 'react-router-dom';
import type { Match } from '@/domain/types';
import { crewColumnLines } from '@/features/referee/appointments/crewLines';
import { backState, type BackNav } from '@/nav/backNav';

/** Referee assignment column — used on Appointments and Global Schedule. */
export function MatchCrewTrailing({
  match,
  highlightUserId,
  redactNames = false,
  back,
}: {
  match: Match;
  /** When set, that official’s line renders as a pill. */
  highlightUserId?: string;
  /** Team-facing before MO unlock — roles + fill, no names. */
  redactNames?: boolean;
  back?: BackNav;
}) {
  const lines = crewColumnLines(match, { highlightUserId, redactNames });

  return (
    <Link
      to={`/matches/${match.id}`}
      state={back ? backState(back) : undefined}
      className="rs-appt-crew rs-appt-crew-hit"
      aria-label="Open match crew"
      onClick={(e) => e.stopPropagation()}
    >
      {lines.map((line) =>
        line.isMine ? (
          <span key={line.id} className="rs-pill rs-appt-crew__mine">
            {line.slotLabel} {line.value}
          </span>
        ) : (
          <p key={line.id} className="rs-appt-crew__line">
            <span className="rs-appt-crew__slot">{line.slotLabel}</span>{' '}
            {line.value}
          </p>
        ),
      )}
    </Link>
  );
}
