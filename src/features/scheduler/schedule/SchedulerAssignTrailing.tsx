import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUserPlus } from '@fortawesome/free-solid-svg-icons';
import { openCrewAssignTargets } from '@/domain/requests';
import {
  REQUESTABLE_SLOT_LABELS,
  REQUESTABLE_SLOT_SHORT,
  type Match,
} from '@/domain/types';
import type { CrewPickTarget } from '@/features/matches/AssignOfficialModal';
import { MatchCrewTrailing } from '@/ui/MatchCrewTrailing';
import type { BackNav } from '@/nav/backNav';

/** Open slots assign inline; otherwise show crew column (link to match). */
export function SchedulerAssignTrailing({
  match,
  back,
  highlightUserId,
  onPick,
}: {
  match: Match;
  back: BackNav;
  highlightUserId?: string;
  onPick: (target: CrewPickTarget) => void;
}) {
  const openSlots = openCrewAssignTargets(match);

  if (openSlots.length === 0) {
    return (
      <MatchCrewTrailing
        match={match}
        highlightUserId={highlightUserId}
        back={back}
      />
    );
  }

  return (
    <div className="rs-queue-action">
      <span className="rs-queue-action__sign" aria-hidden>
        <FontAwesomeIcon icon={faUserPlus} />
      </span>
      <div
        className="rs-queue-action__slots"
        role="group"
        aria-label="Open positions"
      >
        {openSlots.map((target) => (
          <button
            key={`${target.slot}-${target.assignmentId ?? 'open'}`}
            type="button"
            className="rs-filter-chip"
            aria-label={`Assign ${REQUESTABLE_SLOT_LABELS[target.slot]}`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onPick({
                slot: target.slot,
                assignmentId: target.assignmentId,
              });
            }}
          >
            {REQUESTABLE_SLOT_SHORT[target.slot]}
          </button>
        ))}
      </div>
    </div>
  );
}
