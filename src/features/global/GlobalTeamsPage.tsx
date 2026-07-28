import { EmptyState, EmptyStateBody } from '@patternfly/react-core';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '@/app/AppContext';
import { releasedMatches } from '@/domain/visibility';
import {
  genderLabel,
  type MatchGender,
  type Team,
} from '@/domain/types';
import { GlobalDivisionFilters } from '@/features/global/GlobalDivisionFilters';
import { backState } from '@/nav/backNav';

type TeamListItem = {
  team: Team;
  genders: MatchGender[];
  levels: string[];
  matchCount: number;
};

/**
 * Team list — tap through to that club’s match cards (scores from reports).
 */
export function GlobalTeamsPage() {
  const { state } = useApp();
  const [genderFilter, setGenderFilter] = useState<MatchGender | null>(null);
  const [levelFilter, setLevelFilter] = useState<string | null>(null);

  const levels = state.org.matchLevels;

  const teams = useMemo(() => {
    const byId = new Map<string, TeamListItem>();
    for (const m of releasedMatches(state.matches)) {
      for (const side of [
        { id: m.homeTeamId, name: m.homeTeamName },
        { id: m.awayTeamId, name: m.awayTeamName },
      ] as const) {
        let entry = byId.get(side.id);
        if (!entry) {
          const fromStore = state.teams.find((t) => t.id === side.id);
          entry = {
            team: fromStore ?? {
              id: side.id,
              name: side.name,
              contactEmails: [],
            },
            genders: [],
            levels: [],
            matchCount: 0,
          };
          byId.set(side.id, entry);
        }
        entry.matchCount += 1;
        if (!entry.genders.includes(m.gender)) entry.genders.push(m.gender);
        if (!entry.levels.includes(m.level)) entry.levels.push(m.level);
      }
    }

    return [...byId.values()]
      .filter((item) => {
        if (genderFilter && !item.genders.includes(genderFilter)) return false;
        if (levelFilter && !item.levels.includes(levelFilter)) return false;
        return true;
      })
      .sort((a, b) => a.team.name.localeCompare(b.team.name));
  }, [state.matches, state.teams, genderFilter, levelFilter]);

  const hasBase = state.teams.length > 0 || releasedMatches(state.matches).length > 0;

  return (
    <>
      {hasBase && (
        <GlobalDivisionFilters
          levels={levels}
          genderFilter={genderFilter}
          levelFilter={levelFilter}
          onGenderChange={setGenderFilter}
          onLevelChange={setLevelFilter}
          ariaLabel="Filter teams"
        />
      )}

      {!hasBase ? (
        <EmptyState titleText="No teams" headingLevel="h3">
          <EmptyStateBody>Teams will show up when the schedule is loaded.</EmptyStateBody>
        </EmptyState>
      ) : teams.length === 0 ? (
        <EmptyState titleText="No matching teams" headingLevel="h3">
          <EmptyStateBody>
            No teams match these filters. Tap a chip again to clear it.
          </EmptyStateBody>
        </EmptyState>
      ) : (
        <ul className="rs-list" aria-label="Teams">
          {teams.map(({ team, genders, levels: teamLevels, matchCount }) => (
            <li key={team.id}>
              <Link
                to={`/global/teams/${team.id}`}
                state={backState({ to: '/global/teams', label: 'Teams' })}
                className="rs-team-card rs-team-card--link"
              >
                <div className="rs-team-card__head">
                  <p className="rs-team-card__name">{team.name}</p>
                  <div className="rs-label-row" aria-label="Divisions">
                    {genders.map((g) => (
                      <span key={g} className="rs-pill rs-pill--ink rs-list-row__chip">
                        {genderLabel(g)}
                      </span>
                    ))}
                    {teamLevels.map((lv) => (
                      <span key={lv} className="rs-pill rs-pill--ink rs-list-row__chip">
                        {lv}
                      </span>
                    ))}
                  </div>
                </div>
                <p className="rs-team-card__hint">
                  {matchCount} match{matchCount === 1 ? '' : 'es'} · Tap for
                  scores
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
