import { crewColumnLines } from '@/features/referee/appointments/crewLines';
import type { Match } from '@/domain/types';
import type { CrewPickTarget } from '@/features/matches/AssignOfficialModal';
import { CrewColumnContent } from '@/ui/CrewColumnContent';
import type { BackNav } from '@/nav/backNav';

/** Scheduler schedule column — every needed role with open + pending + confirmed. */
export function SchedulerAssignTrailing({
  match,
  back,
  highlightUserId,
  doubleBookedUserIds,
  onPick,
}: {
  match: Match;
  back: BackNav;
  highlightUserId?: string;
  doubleBookedUserIds?: ReadonlySet<string> | string[];
  onPick: (target: CrewPickTarget) => void;
}) {
  const lines = crewColumnLines(match, {
    highlightUserId,
    assignableOpen: true,
    doubleBookedUserIds,
  });

  return (
    <CrewColumnContent
      lines={lines}
      matchTo={`/matches/${match.id}`}
      back={back}
      onAssignOpen={(target) => onPick(target)}
    />
  );
}
