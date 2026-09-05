import { useId, useState } from 'react';
import {
  Toolbar,
  ToolbarContent,
  ToolbarFilter,
  ToolbarItem,
} from '@patternfly/react-core';
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
  const showCompetitions = options.competitions.length > 1;
  const showTiers = options.levels.length > 0;
  const showGenders =
    options.genders.length > 1 &&
    !competitionsEncodeGender(options.competitions);
  const formatOptions =
    options.formats.length > 0
      ? options.formats
      : [...GAMEPLAY_FORMATS];
  const showFormats = true;
  const showRoleFilter = showRoles && roleOptions.length > 0;

  const patch = (partial: Partial<AvailableMatchesFilterState>) => {
    onFiltersChange({ ...filters, ...partial });
  };

  const clearCategory = (
    key: keyof Pick<
      AvailableMatchesFilterState,
      'competitions' | 'tiers' | 'genders' | 'formats' | 'roles'
    >,
  ) => {
    patch({ [key]: [] });
  };

  const removeLabel = (
    key: keyof Pick<
      AvailableMatchesFilterState,
      'competitions' | 'tiers' | 'genders' | 'formats' | 'roles'
    >,
    label: string,
  ) => {
    patch({
      [key]: filters[key].filter((value) => value !== label),
    });
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

  const [expanded, setExpanded] = useState(false);
  const panelId = useId();

  if (
    !showCompetitions &&
    !showTiers &&
    !showGenders &&
    !showFormats &&
    !showRoleFilter &&
    availableDates == null
  ) {
    return null;
  }

  return (
    <Toolbar
      className={`rs-available-filters pf-m-toggle-group-container${
        expanded ? ' rs-available-filters--expanded' : ''
      }`}
      clearAllFilters={hasAnyFilter ? clearAll : undefined}
    >
      <ToolbarContent aria-label={ariaLabel}>
        <ToolbarItem className="rs-available-filters__toggle-wrap">
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
        </ToolbarItem>

        <ToolbarItem
          id={panelId}
          className="rs-available-filters__panel"
        >
          <div className="rs-available-filters__panel-inner">
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
            <ToolbarFilter
              categoryName="Competition"
              labels={filters.competitions}
              deleteLabel={(_category, label) =>
                removeLabel('competitions', String(label))
              }
              deleteLabelGroup={() => clearCategory('competitions')}
            >
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
            </ToolbarFilter>
          )}

          {showTiers && (
            <ToolbarFilter
              categoryName="Tier"
              labels={filters.tiers}
              deleteLabel={(_category, label) =>
                removeLabel('tiers', String(label))
              }
              deleteLabelGroup={() => clearCategory('tiers')}
            >
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
            </ToolbarFilter>
          )}

          {showGenders && (
            <ToolbarFilter
              categoryName="Gender"
              labels={filters.genders.map((g) => genderLabel(g))}
              deleteLabel={(_category, label) => {
                const gender = options.genders.find(
                  (g) => genderLabel(g) === String(label),
                );
                if (gender) removeLabel('genders', gender);
              }}
              deleteLabelGroup={() => clearCategory('genders')}
            >
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
            </ToolbarFilter>
          )}

          {showFormats && (
            <ToolbarFilter
              categoryName="Format"
              labels={filters.formats}
              deleteLabel={(_category, label) =>
                removeLabel('formats', String(label))
              }
              deleteLabelGroup={() => clearCategory('formats')}
            >
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
            </ToolbarFilter>
          )}

          {showRoleFilter && (
            <ToolbarFilter
              categoryName="Open role"
              labels={filters.roles.map(
                (role) =>
                  roleOptions.find((opt) => opt.value === role)?.label ?? role,
              )}
              deleteLabel={(_category, label) => {
                const role = roleOptions.find((opt) => opt.label === String(label));
                if (role) removeLabel('roles', role.value);
              }}
              deleteLabelGroup={() => clearCategory('roles')}
            >
              <RsMultiFilterSelect
                label="Open role"
                placeholder="All positions"
                selected={filters.roles}
                onChange={(roles) => patch({ roles })}
                options={roleOptions}
              />
            </ToolbarFilter>
          )}
            </div>
          </div>
        </ToolbarItem>
      </ToolbarContent>
    </Toolbar>
  );
}
