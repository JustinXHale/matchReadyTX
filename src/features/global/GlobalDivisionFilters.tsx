import { useEffect, useMemo } from 'react';
import {
  genderLabel,
  type MatchGender,
} from '@/domain/types';
import {
  competitionsEncodeGender,
  type DivisionFilterOptions,
} from '@/domain/divisionFilters';
import { RsDateField } from '@/ui/RsDateField';

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
  availableDates,
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
  /** YYYY-MM-DD days that have games — other calendar days are unselectable. */
  availableDates?: string[];
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

  const availableSet = useMemo(
    () => new Set(availableDates ?? []),
    [availableDates],
  );

  useEffect(() => {
    if (!onDateChange || !dateFilter) return;
    if (availableDates == null) return;
    if (!availableSet.has(dateFilter)) onDateChange(null);
  }, [availableDates, availableSet, dateFilter, onDateChange]);

  const competitionSelectSizer = useMemo(() => {
    let longest = 'All competitions';
    for (const comp of options.competitions) {
      if (comp.length > longest.length) longest = comp;
    }
    return longest;
  }, [options.competitions]);

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
            <label className="rs-filter-field rs-filter-field--competition">
              <span className="rs-filter-field__label">Competition</span>
              <span className="rs-filter-select-wrap">
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
                <span className="rs-filter-select-sizer" aria-hidden>
                  {competitionSelectSizer}
                </span>
              </span>
            </label>
          )}
          {showDate && onDateChange && (
            <label className="rs-filter-field rs-filter-field--date">
              <span className="rs-filter-field__label">Date</span>
              <RsDateField
                className="rs-filter-date"
                value={dateFilter ?? ''}
                aria-label="Filter by date"
                availableDates={availableDates}
                onChange={onDateChange}
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
