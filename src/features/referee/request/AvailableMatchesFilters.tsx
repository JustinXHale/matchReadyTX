import { useEffect, useId, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import {
  competitionsEncodeGender,
  type DivisionFilterOptions,
} from '@/domain/divisionFilters';
import { GAMEPLAY_FORMATS } from '@/domain/matchGameplayFormat';
import { genderLabel, type MatchGender } from '@/domain/types';
import { RsDateField } from '@/ui/RsDateField';
import { RsMultiFilterSelect } from '@/ui/RsMultiFilterSelect';
import './request.css';

export type AvailableMatchesFilterState = {
  date: string | null;
  competitions: string[];
  tiers: string[];
  genders: MatchGender[];
  formats: string[];
  roles: string[];
};

type RoleFilterOption = { value: string; label: string };

const MOBILE_FILTERS_MQ = '(max-width: 767px)';

function useMobileFiltersLayout(): boolean {
  const [mobile, setMobile] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia(MOBILE_FILTERS_MQ).matches
      : false,
  );

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_FILTERS_MQ);
    const onChange = () => setMobile(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return mobile;
}

export function AvailableMatchesFilters({
  options,
  filters,
  onFiltersChange,
  availableDates,
  roleOptions,
  showRoles,
  ariaLabel = 'Filter requestable games',
}: {
  options: DivisionFilterOptions;
  filters: AvailableMatchesFilterState;
  onFiltersChange: (next: AvailableMatchesFilterState) => void;
  availableDates?: string[];
  roleOptions: RoleFilterOption[];
  showRoles: boolean;
  ariaLabel?: string;
}) {
  const mobileLayout = useMobileFiltersLayout();
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();
  const location = useLocation();

  useEffect(() => {
    setExpanded(false);
  }, [location.pathname, location.search]);

  const showCompetitions = options.competitions.length > 1;
  const showTiers = options.levels.length > 0;
  const showGenders =
    options.genders.length > 1 &&
    !competitionsEncodeGender(options.competitions);
  const formatOptions =
    options.formats.length > 0 ? options.formats : [...GAMEPLAY_FORMATS];
  const showRoleFilter = showRoles && roleOptions.length > 0;

  const patch = (partial: Partial<AvailableMatchesFilterState>) => {
    onFiltersChange({ ...filters, ...partial });
  };

  const clearAll = () => {
    onFiltersChange({
      date: null,
      competitions: [],
      tiers: [],
      genders: [],
      formats: [],
      roles: [],
    });
  };

  const hasAnyFilter =
    filters.date != null ||
    filters.competitions.length > 0 ||
    filters.tiers.length > 0 ||
    filters.genders.length > 0 ||
    filters.formats.length > 0 ||
    filters.roles.length > 0;

  const activeFilterCount =
    (filters.date ? 1 : 0) +
    filters.competitions.length +
    filters.tiers.length +
    filters.genders.length +
    filters.formats.length +
    filters.roles.length;

  if (
    !showCompetitions &&
    !showTiers &&
    !showGenders &&
    !formatOptions.length &&
    !showRoleFilter &&
    availableDates == null
  ) {
    return null;
  }

  const showPanel = !mobileLayout || expanded;

  const filterFields: ReactNode = (
    <>
      <div className="rs-available-filters__date">
        <label className="rs-filter-field rs-filter-field--date">
          <span className="rs-filter-field__label">Date</span>
          <RsDateField
            className="rs-filter-date"
            value={filters.date ?? ''}
            aria-label="Filter by date"
            availableDates={availableDates}
            onChange={(next) => patch({ date: next })}
          />
        </label>
      </div>

      <div className="rs-available-filters__group">
        {showCompetitions && (
          <RsMultiFilterSelect
            label="Competition"
            placeholder="All competitions"
            selected={filters.competitions}
            onChange={(competitions) => patch({ competitions })}
            options={options.competitions.map((value) => ({
              value,
              label: value,
            }))}
          />
        )}

        {showTiers && (
          <RsMultiFilterSelect
            label="Tier"
            placeholder="All tiers"
            selected={filters.tiers}
            onChange={(tiers) => patch({ tiers })}
            options={options.levels.map((value) => ({
              value,
              label: value,
            }))}
          />
        )}

        {showGenders && (
          <RsMultiFilterSelect
            label="Gender"
            placeholder="All genders"
            selected={filters.genders}
            onChange={(genders) =>
              patch({ genders: genders as MatchGender[] })
            }
            options={options.genders.map((g) => ({
              value: g,
              label: genderLabel(g),
            }))}
          />
        )}

        <RsMultiFilterSelect
          label="Format"
          placeholder="All formats"
          selected={filters.formats}
          onChange={(formats) => patch({ formats })}
          options={formatOptions.map((value) => ({
            value,
            label: value,
          }))}
        />

        {showRoleFilter && (
          <RsMultiFilterSelect
            label="Open role"
            placeholder="All positions"
            selected={filters.roles}
            onChange={(roles) => patch({ roles })}
            options={roleOptions}
          />
        )}
      </div>
    </>
  );

  return (
    <div
      className={`rs-available-filters${
        expanded ? ' rs-available-filters--expanded' : ''
      }`}
      role="search"
      aria-label={ariaLabel}
    >
      {mobileLayout && (
        <button
          type="button"
          className="rs-available-filters__toggle"
          aria-expanded={expanded}
          aria-controls={panelId}
          onClick={() => setExpanded((open) => !open)}
        >
          <span className="rs-available-filters__toggle-label">Filters</span>
          {activeFilterCount > 0 ? (
            <span className="rs-available-filters__toggle-count">
              {activeFilterCount}
            </span>
          ) : null}
          <span className="rs-available-filters__toggle-icon" aria-hidden>
            {expanded ? '▾' : '▸'}
          </span>
        </button>
      )}

      {showPanel && (
        <div id={panelId} className="rs-available-filters__panel">
          <div className="rs-available-filters__panel-inner">{filterFields}</div>
          {hasAnyFilter && (
            <div className="rs-available-filters__clear">
              <button
                type="button"
                className="rs-available-filters__clear-btn"
                onClick={clearAll}
              >
                Clear all filters
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
