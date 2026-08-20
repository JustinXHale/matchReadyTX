import {
  genderLabel,
  type MatchGender,
} from '@/domain/types';
import type { DivisionFilterOptions } from '@/domain/divisionFilters';
import { competitionsEncodeGender } from '@/domain/divisionFilters';
import { IconDateInput } from '@/ui/IconDateInput';

/** Comp / level / gender filters derived from the current dataset. */
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
  hideLevels = false,
  hideGenders = false,
  stageSecondary = true,
  showDate = false,
  dateFilter = null,
  onDateChange,
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
  hideLevels?: boolean;
  hideGenders?: boolean;
  /**
   * When multiple competitions exist, hide level/gender until one is chosen.
   * Crew defaults passes false so a level is always pickable.
   */
  stageSecondary?: boolean;
  showDate?: boolean;
  dateFilter?: string | null;
  onDateChange?: (next: string | null) => void;
}) {
  const showCompetitionSelect = options.competitions.length > 1;
  const secondaryUnlocked =
    !stageSecondary || !showCompetitionSelect || competitionFilter != null;
  const showLevels =
    !hideLevels &&
    secondaryUnlocked &&
    (showSingleLevel ? options.levels.length > 0 : options.levels.length > 1);
  const genderInCompetitionNames = competitionsEncodeGender(
    options.competitions,
  );
  const showGenders =
    !hideGenders &&
    secondaryUnlocked &&
    options.genders.length > 1 &&
    !genderInCompetitionNames;

  if (!showCompetitionSelect && !showLevels && !showGenders && !showDate) {
    return null;
  }

  const setCompetition = (next: string | null) => {
    if (next !== competitionFilter) {
      onLevelChange(null);
      onGenderChange(null);
    }
    onCompetitionChange(next);
  };

  return (
    <div className="rs-filter-bar" role="group" aria-label={ariaLabel}>
      {(showCompetitionSelect || showDate) && (
        <div
          className={`rs-filter-bar__row${
            showCompetitionSelect && showDate ? ' rs-filter-bar__row--dual' : ''
          }`}
        >
          {showCompetitionSelect && (
            <label className="rs-filter-field">
              <span className="rs-filter-field__label">Competition</span>
              <select
                className="rs-filter-select"
                value={competitionFilter ?? ''}
                onChange={(e) => setCompetition(e.target.value || null)}
              >
                <option value="">All competitions</option>
                {options.competitions.map((comp) => (
                  <option key={comp} value={comp}>
                    {comp}
                  </option>
                ))}
              </select>
            </label>
          )}
          {showDate && onDateChange && (
            <label className="rs-filter-field">
              <span className="rs-filter-field__label">Date</span>
              <IconDateInput
                aria-label="Filter by date"
                type="date"
                value={dateFilter ?? ''}
                onChange={(_, v) => onDateChange(v || null)}
              />
            </label>
          )}
        </div>
      )}
      {(showLevels || showGenders) && (
        <div className="rs-filter-chips" role="group" aria-label="Level and gender">
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
          {showLevels && showGenders && (
            <span className="rs-filter-sep" aria-hidden />
          )}
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
      )}
    </div>
  );
}
