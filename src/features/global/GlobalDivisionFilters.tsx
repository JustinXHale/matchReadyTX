import { useEffect, useMemo, type ReactNode } from 'react';
import {
  genderLabel,
  type MatchGender,
} from '@/domain/types';
import {
  competitionsEncodeGender,
  type DivisionFilterOptions,
} from '@/domain/divisionFilters';
import { RsDateField } from '@/ui/RsDateField';
import { RsFilterSelect } from '@/ui/RsFilterSelect';

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
  layout = 'chips',
  showSingleLevel = false,
  hideLevels = false,
  hideGenders = false,
  stageSecondary = true,
  levelChipAriaLabel = 'Filter by tier',
  showDate = false,
  dateFilter = null,
  onDateChange,
  availableDates,
  rowEnd,
}: {
  options: DivisionFilterOptions;
  genderFilter: MatchGender | null;
  levelFilter: string | null;
  competitionFilter: string | null;
  onGenderChange: (next: MatchGender | null) => void;
  onLevelChange: (next: string | null) => void;
  onCompetitionChange: (next: string | null) => void;
  ariaLabel?: string;
  /** Chip row vs compact dropdown row. */
  layout?: 'chips' | 'dropdowns';
  /** Show level chips even when only one level (crew defaults editor). */
  showSingleLevel?: boolean;
  hideLevels?: boolean;
  hideGenders?: boolean;
  /**
   * When multiple competitions exist, hide level/gender until one is chosen.
   * Crew defaults passes false so a level is always pickable.
   */
  stageSecondary?: boolean;
  levelChipAriaLabel?: string;
  showDate?: boolean;
  dateFilter?: string | null;
  onDateChange?: (next: string | null) => void;
  /** YYYY-MM-DD days that have games — other calendar days are unselectable. */
  availableDates?: string[];
  /** Extra controls appended to the filter row (e.g. role picker). */
  rowEnd?: ReactNode;
}) {
  const useDropdowns = layout === 'dropdowns';
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

  const competitionOptions = useMemo(
    () => options.competitions.map((comp) => ({ value: comp, label: comp })),
    [options.competitions],
  );

  const levelOptions = useMemo(
    () => options.levels.map((level) => ({ value: level, label: level })),
    [options.levels],
  );

  const genderOptions = useMemo(
    () =>
      options.genders.map((g) => ({
        value: g,
        label: genderLabel(g),
      })),
    [options.genders],
  );

  const showFilterRow =
    showCompetitionSelect ||
    showDate ||
    rowEnd != null ||
    (useDropdowns && (showLevels || showGenders));

  if (!showFilterRow && !showLevels && !showGenders && !showDate) {
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
      {showFilterRow && (
        <div className="rs-filter-bar__row">
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
          {showCompetitionSelect && (
            <RsFilterSelect
              label="Competition"
              value={competitionFilter}
              onChange={setCompetition}
              placeholder="All competitions"
              options={competitionOptions}
              className={
                useDropdowns ? undefined : 'rs-filter-field--competition'
              }
            />
          )}
          {useDropdowns && showLevels && (
            <RsFilterSelect
              label="Tier"
              value={levelFilter}
              onChange={onLevelChange}
              placeholder="All tiers"
              options={levelOptions}
            />
          )}
          {useDropdowns && showGenders && (
            <RsFilterSelect
              label="Gender"
              value={genderFilter}
              onChange={(next) => onGenderChange(next as MatchGender | null)}
              placeholder="All genders"
              options={genderOptions}
            />
          )}
          {rowEnd}
        </div>
      )}
      {!useDropdowns && (showLevels || showGenders) && (
        <div
          className="rs-filter-chips"
          role="group"
          aria-label={levelChipAriaLabel}
        >
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
