import { EmptyState, EmptyStateBody, Title } from '@patternfly/react-core';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/app/AppContext';
import { standingsByDivision, standingsCombined } from '@/domain/standings';
import { divisionFilterOptionsFromMatches } from '@/domain/divisionFilters';
import { matchInCompetition } from '@/domain/competitions';
import type { MatchGender } from '@/domain/types';
import { GlobalDivisionFilters } from '@/features/global/GlobalDivisionFilters';
import { backState } from '@/nav/backNav';

type StandingsViewMode = 'combined' | 'by_tier';

export function GlobalStandingsPage() {
  const { state } = useApp();
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<StandingsViewMode>('combined');
  const [genderFilter, setGenderFilter] = useState<MatchGender | null>(null);
  const [levelFilter, setLevelFilter] = useState<string | null>(null);
  const [competitionFilter, setCompetitionFilter] = useState<string | null>(
    null,
  );

  const filterOptions = useMemo(
    () => divisionFilterOptionsFromMatches(state.matches, competitionFilter),
    [state.matches, competitionFilter],
  );

  const filteredMatches = useMemo(() => {
    return state.matches.filter((m) => {
      if (genderFilter && m.gender !== genderFilter) return false;
      if (viewMode === 'by_tier' && levelFilter && m.level !== levelFilter) {
        return false;
      }
      if (competitionFilter && !matchInCompetition(m, competitionFilter)) {
        return false;
      }
      return true;
    });
  }, [
    state.matches,
    genderFilter,
    levelFilter,
    competitionFilter,
    viewMode,
  ]);

  const groups = useMemo(() => {
    return viewMode === 'combined'
      ? standingsCombined(filteredMatches)
      : standingsByDivision(filteredMatches);
  }, [filteredMatches, viewMode]);

  const hasBase = useMemo(
    () =>
      (viewMode === 'combined'
        ? standingsCombined(state.matches)
        : standingsByDivision(state.matches)
      ).length > 0,
    [state.matches, viewMode],
  );

  const setViewModeAndClearTier = (mode: StandingsViewMode) => {
    setViewMode(mode);
    if (mode === 'combined') setLevelFilter(null);
  };

  return (
    <>
      {hasBase && (
        <>
          <GlobalDivisionFilters
            options={filterOptions}
            genderFilter={genderFilter}
            levelFilter={levelFilter}
            competitionFilter={competitionFilter}
            onGenderChange={setGenderFilter}
            onLevelChange={setLevelFilter}
            onCompetitionChange={setCompetitionFilter}
            hideLevels={viewMode === 'combined'}
            ariaLabel="Filter standings"
          />
          <div
            className="rs-filter-chips rs-schedule-sort"
            role="group"
            aria-label="Standings layout"
          >
            <button
              type="button"
              className={`rs-filter-chip${viewMode === 'combined' ? ' rs-filter-chip--selected' : ''}`}
              aria-pressed={viewMode === 'combined'}
              onClick={() => setViewModeAndClearTier('combined')}
            >
              All teams
            </button>
            <button
              type="button"
              className={`rs-filter-chip${viewMode === 'by_tier' ? ' rs-filter-chip--selected' : ''}`}
              aria-pressed={viewMode === 'by_tier'}
              onClick={() => setViewModeAndClearTier('by_tier')}
            >
              By tier
            </button>
          </div>
        </>
      )}

      {!hasBase ? (
        <EmptyState titleText="No standings yet" headingLevel="h3">
          <EmptyStateBody>
            Standings appear after matches have final scores.
          </EmptyStateBody>
        </EmptyState>
      ) : groups.length === 0 ? (
        <EmptyState titleText="No matching standings" headingLevel="h3">
          <EmptyStateBody>
            No standings match these filters. Tap a chip again to clear it.
          </EmptyStateBody>
        </EmptyState>
      ) : (
        <div className="rs-standings">
          {groups.map((group) => (
            <section key={group.key} className="rs-standings__group">
              <Title headingLevel="h3" size="md" className="rs-month-heading">
                {group.label}
              </Title>
              <div className="rs-standings__scroll">
                <table className="rs-standings__table">
                  <thead>
                    <tr>
                      <th scope="col" className="rs-standings__team">
                        Team
                      </th>
                      <th scope="col">W</th>
                      <th scope="col">L</th>
                      <th scope="col">T</th>
                      <th scope="col">PF</th>
                      <th scope="col">PA</th>
                      <th scope="col">PD</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.rows.map((row) => (
                      <tr
                        key={row.teamId}
                        className="rs-standings__row"
                        tabIndex={0}
                        role="link"
                        aria-label={`Open ${row.teamName}`}
                        onClick={() =>
                          navigate(`/global/teams/${row.teamId}`, {
                            state: backState({
                              to: '/global/standings',
                              label: 'Standings',
                            }),
                          })
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            navigate(`/global/teams/${row.teamId}`, {
                              state: backState({
                                to: '/global/standings',
                                label: 'Standings',
                              }),
                            });
                          }
                        }}
                      >
                        <th scope="row" className="rs-standings__team">
                          {row.teamName}
                        </th>
                        <td>{row.w}</td>
                        <td>{row.l}</td>
                        <td>{row.t}</td>
                        <td>{row.pf}</td>
                        <td>{row.pa}</td>
                        <td>{row.pd > 0 ? `+${row.pd}` : row.pd}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
