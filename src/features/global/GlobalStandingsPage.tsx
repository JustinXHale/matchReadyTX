import { EmptyState, EmptyStateBody, Title } from '@patternfly/react-core';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/app/AppContext';
import { standingsByDivision } from '@/domain/standings';
import type { MatchGender } from '@/domain/types';
import { GlobalDivisionFilters } from '@/features/global/GlobalDivisionFilters';
import { backState } from '@/nav/backNav';

export function GlobalStandingsPage() {
  const { state } = useApp();
  const navigate = useNavigate();
  const [genderFilter, setGenderFilter] = useState<MatchGender | null>(null);
  const [levelFilter, setLevelFilter] = useState<string | null>(null);

  const levels = state.org.matchLevels;

  const allGroups = useMemo(
    () => standingsByDivision(state.matches),
    [state.matches],
  );

  const groups = useMemo(() => {
    return allGroups.filter((g) => {
      if (genderFilter && g.gender !== genderFilter) return false;
      if (levelFilter && g.level !== levelFilter) return false;
      return true;
    });
  }, [allGroups, genderFilter, levelFilter]);

  const hasBase = allGroups.length > 0;

  return (
    <>
      {hasBase && (
        <GlobalDivisionFilters
          levels={levels}
          genderFilter={genderFilter}
          levelFilter={levelFilter}
          onGenderChange={setGenderFilter}
          onLevelChange={setLevelFilter}
          ariaLabel="Filter standings"
        />
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
