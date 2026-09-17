import type { Match } from '@/domain/types';
import { summarizeCoverageCrew } from '@/features/referee/appointments/crewLines';

/** Read-only crew strip under a match row (raise-hand queue, etc.). */
export function CoverageMatchCrewSummary({ match }: { match: Match }) {
  const preview = summarizeCoverageCrew(match);
  if (!preview) return null;

  return (
    <div
      className="rs-coverage-requesters rs-coverage-crew"
      aria-label="Current crew assignments"
    >
      <div className="rs-coverage-requesters__summary-main">
        <span className="rs-coverage-requesters__label">Crew</span>
        <span className="rs-coverage-requesters__preview">{preview}</span>
      </div>
    </div>
  );
}
