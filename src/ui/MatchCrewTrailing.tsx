import { Link } from 'react-router-dom';
import {
  rolesNeededForMatch,
  type CrewSlot,
  type Match,
} from '@/domain/types';
import {
  APPOINTMENT_CREW_ORDER,
  crewKeyShortLabel,
  crewValueForKey,
  type AppointmentCrewKey,
} from '@/features/referee/appointments/crewLines';
import { backState, type BackNav } from '@/nav/backNav';

/** Referee assignment column — used on Appointments and Global Schedule. */
export function MatchCrewTrailing({
  match,
  highlightSlot,
  back,
}: {
  match: Match;
  /** When set, that slot renders as a pill (viewer’s assignment). */
  highlightSlot?: CrewSlot | null;
  back?: BackNav;
}) {
  const activeRoles = new Set(rolesNeededForMatch(match));
  const visibleKeys = APPOINTMENT_CREW_ORDER.filter((key) =>
    key === 'cmo' ? activeRoles.has('cmo') : activeRoles.has(key),
  );

  return (
    <Link
      to={`/matches/${match.id}`}
      state={back ? backState(back) : undefined}
      className="rs-appt-crew rs-appt-crew-hit"
      aria-label="Open match crew"
      onClick={(e) => e.stopPropagation()}
    >
      {visibleKeys.map((key: AppointmentCrewKey) => {
        const isMine = Boolean(highlightSlot && key === highlightSlot);
        const label = crewKeyShortLabel(key);
        if (isMine) {
          return (
            <span key={key} className="rs-pill rs-appt-crew__mine">
              {label}
            </span>
          );
        }
        return (
          <p key={key} className="rs-appt-crew__line">
            <span className="rs-appt-crew__slot">{label}</span>{' '}
            {crewValueForKey(match, key)}
          </p>
        );
      })}
    </Link>
  );
}
