import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState, EmptyStateBody } from '@patternfly/react-core';
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

/**
 * Scheduler team directory — every club on the synced schedule, home location,
 * registered admins, and Contacts-sheet emails.
 */
export function SchedulerTeamsPage() {
  const { state } = useApp();
  const teamsBaseHref = useAppHref('/members/teams');

  const entries = useMemo(
    () => scheduleTeamEntries(state.matches, state.teams),
    [state.matches, state.teams],
  );

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
      <ul className="rs-list" aria-label="Teams">
        {entries.map(({ team, matchCount, competitions }) => {
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
                    <p className="rs-team-card__abbr">{team.abbreviation.trim()}</p>
                  ) : null}
                </div>
                <p className="rs-team-card__hint">
                  {teamConferenceLabel(competitions)}
                </p>
                <p className="rs-team-card__hint">
                  {address}
                </p>
                <p className="rs-team-card__hint">
                  {matchCount} match{matchCount === 1 ? '' : 'es'} ·{' '}
                  {adminLabel}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
