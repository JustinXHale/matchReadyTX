import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState, EmptyStateBody, TextInput } from '@patternfly/react-core';
import { useApp, useAppHref } from '@/app/AppContext';
import {
  formatTeamAddress,
  scheduleTeamEntries,
  teamAdminsForTeam,
  teamConferenceLabel,
  teamContactEmails,
} from '@/domain/teams';
import { memberListName } from '@/domain/members';
import { backState } from '@/nav/backNav';
import { GlobalDivisionFilters } from '@/features/global/GlobalDivisionFilters';

/**
 * Scheduler team directory — every club on the synced schedule, home location,
 * registered admins, and Contacts-sheet emails.
 */
export function SchedulerTeamsPage() {
  const { state } = useApp();
  const teamsBaseHref = useAppHref('/about/members/teams');
  const [competitionFilter, setCompetitionFilter] = useState<string | null>(
    null,
  );
  const [query, setQuery] = useState('');

  const entries = useMemo(
    () => scheduleTeamEntries(state.matches, state.teams),
    [state.matches, state.teams],
  );

  const filterOptions = useMemo(() => {
    const competitions = [
      ...new Set(entries.flatMap((e) => e.competitions)),
    ].sort((a, b) => a.localeCompare(b));
    return { competitions, levels: [] as string[], genders: [] };
  }, [entries]);

  const visible = useMemo(() => {
    let list = competitionFilter
      ? entries.filter((e) => e.competitions.includes(competitionFilter))
      : entries;
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((entry) => {
      const { team, matchCount, competitions } = entry;
      const address = formatTeamAddress(team, state.matches);
      const admins = teamAdminsForTeam(team.id, state.users);
      const contacts = teamContactEmails(team);
      const adminLabel =
        admins.length > 0
          ? admins.map((u) => memberListName(u)).join(', ')
          : contacts.join(', ');
      const haystack = [
        team.name,
        team.abbreviation,
        teamConferenceLabel(competitions, team),
        address,
        adminLabel,
        `${matchCount} match`,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [entries, competitionFilter, query, state.matches, state.users]);

  if (entries.length === 0) {
    return (
      <EmptyState titleText="No teams" headingLevel="h3">
        <EmptyStateBody>
          Teams appear after you sync the Schedule sheet.
        </EmptyStateBody>
      </EmptyState>
    );
  }

  return (
    <div className="rs-stack">
      <p className="rs-match-card__meta">
        Clubs from your synced schedule — tap a team for contacts and admins.
        Assign someone on their member profile (Team Admin role + clubs).
      </p>
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
        ariaLabel="Filter teams by conference"
      />
      <TextInput
        id="teams-search"
        type="search"
        value={query}
        onChange={(_e, value) => setQuery(value)}
        placeholder="Search teams"
        aria-label="Search teams"
      />
      {visible.length === 0 ? (
        <EmptyState titleText="No matching teams" headingLevel="h3">
          <EmptyStateBody>
            {query.trim()
              ? 'No teams match your search.'
              : 'No clubs in that conference. Choose All competitions to see every club.'}
          </EmptyStateBody>
        </EmptyState>
      ) : (
        <ul className="rs-directory-grid" aria-label="Teams">
          {visible.map(({ team, matchCount, competitions }) => {
            const address = formatTeamAddress(team, state.matches);
            const admins = teamAdminsForTeam(team.id, state.users);
            const contacts = teamContactEmails(team);
            const adminLabel =
              admins.length > 0
                ? admins.map((u) => memberListName(u)).join(', ')
                : contacts.length > 0
                  ? contacts.join(', ')
                  : 'No admin linked';

            return (
              <li key={team.id}>
                <Link
                  to={`${teamsBaseHref}/${team.id}`}
                  state={backState({ to: teamsBaseHref, label: 'Teams' })}
                  className="rs-team-card rs-team-card--link"
                >
                  <div className="rs-team-card__head">
                    <p className="rs-team-card__name">{team.name}</p>
                    {team.abbreviation?.trim() ? (
                      <p className="rs-team-card__abbr">
                        {team.abbreviation.trim()}
                      </p>
                    ) : null}
                  </div>
                  <p className="rs-team-card__hint">
                    {teamConferenceLabel(competitions, team)}
                  </p>
                  <p className="rs-team-card__hint">{address}</p>
                  <p className="rs-team-card__hint">
                    {matchCount} match{matchCount === 1 ? '' : 'es'} ·{' '}
                    {adminLabel}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
