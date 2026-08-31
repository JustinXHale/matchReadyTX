import type { Match } from '@/domain/types';
import { crewColumnLines } from '@/features/referee/appointments/crewLines';
import { CrewColumnContent } from '@/ui/CrewColumnContent';
import type { BackNav } from '@/nav/backNav';

/** Referee assignment column — used on Appointments and League Schedule. */
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
    <CrewColumnContent
      lines={lines}
      matchTo={`/matches/${match.id}`}
      back={back}
    />
  );
}
