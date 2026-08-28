import type { CrewSlot, Match, OrgSettings } from '@/domain/types';
import { feeForSlot } from '@/domain/economics';

/** Compact fee · perks row for list/request surfaces. */
export function MatchEconomicsBar({
  match,
  org,
  slot = 'mo',
  compact,
}: {
  match: Match;
  org: OrgSettings;
  slot?: CrewSlot;
  compact?: boolean;
}) {
  const fee = feeForSlot(match, org, slot);
  return (
    <div
      className={`rs-econ-row${compact ? ' rs-econ-row--compact' : ''}`}
      aria-label="Match pay for you"
    >
      <span className="rs-econ-row__fee">${fee.toFixed(0)}</span>
      {match.flightProvided && (
        <span className="rs-perk-icon" title="Flight provided">
          Flight
        </span>
      )}
      {match.housingProvided && (
        <span className="rs-perk-icon" title="Lodging provided">
          Lodging
        </span>
      )}
    </div>
  );
}
