import {
  genderLabel,
  type MatchGender,
} from '@/domain/types';
import type { DivisionFilterOptions } from '@/domain/divisionFilters';
import { competitionsEncodeGender } from '@/domain/divisionFilters';

/** Comp / level / gender chips derived from the current dataset (hide when not needed). */
export function GlobalDivisionFilters({
  options,
  genderFilter,
  levelFilter,
  competitionFilter,
  onGenderChange,
  onLevelChange,
  onCompetitionChange,
  ariaLabel = 'Filter by division',
  showSingleLevel = false,
}: {
  options: DivisionFilterOptions;
  genderFilter: MatchGender | null;
  levelFilter: string | null;
  competitionFilter: string | null;
  onGenderChange: (next: MatchGender | null) => void;
  onLevelChange: (next: string | null) => void;
  onCompetitionChange: (next: string | null) => void;
  ariaLabel?: string;
  /** Show level chips even when only one level (crew defaults editor). */
  showSingleLevel?: boolean;
}) {
  const showCompetitions = options.competitions.length > 1;
  const showLevels = showSingleLevel
    ? options.levels.length > 0
    : options.levels.length > 1;
  const genderInCompetitionNames = competitionsEncodeGender(
    options.competitions,
  );
  const showGenders =
    options.genders.length > 1 && !genderInCompetitionNames;

  if (!showCompetitions && !showLevels && !showGenders) {
    return null;
  }

  return (
    <div className="rs-filter-chips" role="group" aria-label={ariaLabel}>
      {showCompetitions &&
        options.competitions.map((comp) => (
          <button
            key={comp}
            type="button"
            className={`rs-filter-chip${
              competitionFilter === comp ? ' rs-filter-chip--selected' : ''
            }`}
            aria-pressed={competitionFilter === comp}
            onClick={() =>
              onCompetitionChange(competitionFilter === comp ? null : comp)
            }
          >
            {comp}
          </button>
        ))}
      {showCompetitions && (showLevels || showGenders) && (
        <span className="rs-filter-sep" aria-hidden />
      )}
      {showLevels &&
        options.levels.map((level) => (
          <button
            key={level}
            type="button"
            className={`rs-filter-chip${
              levelFilter === level ? ' rs-filter-chip--selected' : ''
            }`}
            aria-pressed={levelFilter === level}
            onClick={() => onLevelChange(levelFilter === level ? null : level)}
          >
            {level}
          </button>
        ))}
      {showLevels && showGenders && <span className="rs-filter-sep" aria-hidden />}
      {showGenders &&
        options.genders.map((g) => (
          <button
            key={g}
            type="button"
            className={`rs-filter-chip${
              genderFilter === g ? ' rs-filter-chip--selected' : ''
            }`}
            aria-pressed={genderFilter === g}
            onClick={() => onGenderChange(genderFilter === g ? null : g)}
          >
            {genderLabel(g)}
          </button>
        ))}
    </div>
  );
}
