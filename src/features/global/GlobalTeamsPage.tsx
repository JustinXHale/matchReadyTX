import { EmptyState, EmptyStateBody } from '@patternfly/react-core';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '@/app/AppContext';
import { releasedMatches } from '@/domain/visibility';
import { divisionFilterOptionsFromMatches } from '@/domain/divisionFilters';
import { formatTeamAddress } from '@/domain/teams';
import {
  genderLabel,
  type MatchGender,
} from '@/domain/types';
import { GlobalDivisionFilters } from '@/features/global/GlobalDivisionFilters';
import { backState } from '@/nav/backNav';

/**
 * Team list — tap through to that club’s match cards (scores from reports).
 */
export function GlobalTeamsPage() {
  const { state } = useApp();
  const [competitionFilter, setCompetitionFilter] = useState<string | null>(
    null,
  );

  const released = useMemo(
    () => releasedMatches(state.matches),
    [state.matches],
  );

  const filterOptions = useMemo(
    () => divisionFilterOptionsFromMatches(released, competitionFilter),
    [released, competitionFilter],
  );

  const teams = useMemo(() => {
    const byId = new Map<
      string,
      {
        team: (typeof state.teams)[number];
        genders: MatchGender[];
        competitions: string[];
        matchCount: number;
      }
    >();
    for (const m of released) {
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
            competitions: [],
            matchCount: 0,
          };
          byId.set(side.id, entry);
        }
        entry.matchCount += 1;
        if (!entry.genders.includes(m.gender)) entry.genders.push(m.gender);
        if (m.competition && !entry.competitions.includes(m.competition)) {
          entry.competitions.push(m.competition);
        }
      }
    }

    return [...byId.values()]
      .filter((item) => {
        if (
          competitionFilter &&
          !item.competitions.includes(competitionFilter)
        ) {
          return false;
        }
        return true;
      })
      .sort((a, b) => a.team.name.localeCompare(b.team.name));
  }, [released, state.teams, competitionFilter]);

  const hasBase = state.teams.length > 0 || released.length > 0;

  return (
    <>
      {hasBase && (
        <GlobalDivisionFilters
          options={filterOptions}
          genderFilter={null}
          levelFilter={null}
          competitionFilter={competitionFilter}
          onGenderChange={() => undefined}
          onLevelChange={() => undefined}
          onCompetitionChange={setCompetitionFilter}
          hideLevels
          hideGenders
          stageSecondary={false}
          ariaLabel="Filter teams by competition"
        />
      )}

      {!hasBase ? (
        <EmptyState titleText="No teams" headingLevel="h3">
          <EmptyStateBody>Teams will show up when the schedule is loaded.</EmptyStateBody>
        </EmptyState>
      ) : teams.length === 0 ? (
        <EmptyState titleText="No matching teams" headingLevel="h3">
          <EmptyStateBody>
            No teams match this competition. Choose All competitions to see every club.
          </EmptyStateBody>
        </EmptyState>
      ) : (
        <ul className="rs-list" aria-label="Teams">
          {teams.map(({ team, genders, matchCount }) => {
            const address = formatTeamAddress(team, released);
            const abbr = team.abbreviation?.trim();
            return (
              <li key={team.id}>
                <Link
                  to={`/global/teams/${team.id}`}
                  state={backState({ to: '/global/teams', label: 'Teams' })}
                  className="rs-team-card rs-team-card--link"
                >
                  <div className="rs-team-card__head">
                    <p className="rs-team-card__name">{team.name}</p>
                    {abbr ? (
                      <p className="rs-team-card__abbr">{abbr}</p>
                    ) : null}
                    <div className="rs-label-row" aria-label="Gender">
                      {genders.map((g) => (
                        <span
                          key={g}
                          className="rs-pill rs-pill--ink rs-list-row__chip"
                        >
                          {genderLabel(g)}
                        </span>
                      ))}
                    </div>
                  </div>
                  {address !== '—' ? (
                    <p className="rs-team-card__hint">{address}</p>
                  ) : null}
                  <p className="rs-team-card__hint">
                    {matchCount} match{matchCount === 1 ? '' : 'es'} · Tap for
                    scores
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
