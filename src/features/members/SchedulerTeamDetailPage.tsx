import { useMemo } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { EmptyState, EmptyStateBody } from '@patternfly/react-core';
import { useApp, useAppHref } from '@/app/AppContext';
import { memberListName } from '@/domain/members';
import {
  formatTeamAddress,
  scheduleTeamEntries,
  teamConferenceLabel,
  teamHomeMapsUrl,
  teamsFromSchedule,
  teamAdminsForTeam,
  teamContactPeople,
} from '@/domain/teams';
import { useAppBack, backState, type BackNav } from '@/nav/backNav';
import { UserAvatar } from '@/ui/UserAvatar';
import { MatchListRow } from '@/ui/MatchListRow';
import { MapsAddressLink } from '@/ui/MapsAddressLink';

const FALLBACK_BACK: BackNav = { to: '/about/members/teams', label: 'Teams' };

export function SchedulerTeamDetailPage() {
  const { teamId } = useParams();
  const location = useLocation();
  const { state } = useApp();
  const membersHref = useAppHref('/about/members');
  const teamsBaseHref = useAppHref('/about/members/teams');
  const { goBack, backLabel } = useAppBack(FALLBACK_BACK);

  const team = useMemo(() => {
    if (!teamId) return null;
    return teamsFromSchedule(state.matches, state.teams).find(
      (t) => t.id === teamId,
    );
  }, [teamId, state.matches, state.teams]);

  const address = useMemo(
    () => (team ? formatTeamAddress(team, state.matches) : '—'),
    [team, state.matches],
  );
  const mapsUrl = useMemo(
    () => (team ? teamHomeMapsUrl(team, state.matches) : null),
    [team, state.matches],
  );
  const competitions = useMemo(() => {
    if (!teamId) return [] as string[];
    return (
      scheduleTeamEntries(state.matches, state.teams).find(
        (entry) => entry.team.id === teamId,
      )?.competitions ?? []
    );
  }, [teamId, state.matches, state.teams]);

  const admins = useMemo(
    () => (teamId ? teamAdminsForTeam(teamId, state.users) : []),
    [teamId, state.users],
  );

  const contacts = useMemo(
    () => (team ? teamContactPeople(team) : []),
    [team],
  );

  const upcoming = useMemo(() => {
    if (!teamId) return [];
    const now = Date.now();
    return state.matches
      .filter((m) => m.homeTeamId === teamId || m.awayTeamId === teamId)
      .filter((m) => !['cancelled', 'draft', 'postponed'].includes(m.status))
      .filter((m) => new Date(m.kickoffAt).getTime() >= now)
      .sort((a, b) => a.kickoffAt.localeCompare(b.kickoffAt))
      .slice(0, 20);
  }, [teamId, state.matches]);

  const matchBack: BackNav | undefined = team
    ? {
        to: `${teamsBaseHref}/${team.id}`,
        label: team.name,
        state: location.state,
      }
    : undefined;

  if (!team) {
    return (
      <div className="rs-stack">
        <button type="button" className="rs-detail__back" onClick={goBack}>
          ← {backLabel}
        </button>
        <EmptyState titleText="Team not found" headingLevel="h3">
          <EmptyStateBody>That club isn’t on the synced schedule.</EmptyStateBody>
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="rs-stack">
      <button type="button" className="rs-detail__back" onClick={goBack}>
        ← {backLabel}
      </button>

      <section className="rs-detail-card" aria-labelledby="team-name">
        <h2 id="team-name" className="rs-detail-section__label">
          {team.name}
        </h2>
        <dl className="rs-member-dl">
          <div>
            <dt>Conference</dt>
            <dd>{teamConferenceLabel(competitions, team)}</dd>
          </div>
          <div>
            <dt>Home location</dt>
            <dd>
              <MapsAddressLink href={mapsUrl}>{address}</MapsAddressLink>
            </dd>
          </div>
          {team.abbreviation?.trim() ? (
            <div>
              <dt>Abbr.</dt>
              <dd>{team.abbreviation.trim()}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      <section className="rs-detail-card" aria-labelledby="team-admins">
        <h2 id="team-admins" className="rs-detail-section__label">
          Team admins
        </h2>
        {admins.length === 0 ? (
          <p className="rs-detail-note">
            No registered team admins linked to this club yet.
          </p>
        ) : (
          <ul className="rs-list">
            {admins.map((user) => (
              <li key={user.uid}>
                <Link
                  to={`${membersHref}/${user.uid}`}
                  state={backState({
                    to: `${teamsBaseHref}/${team.id}`,
                    label: team.name,
                    state: location.state,
                  })}
                  className="rs-member-row"
                >
                  <UserAvatar user={user} size="md" />
                  <div className="rs-member-row__body">
                    <p className="rs-member-row__name">{memberListName(user)}</p>
                    <p className="rs-member-row__meta">{user.email}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <p className="rs-detail-note pf-v6-u-mt-sm">
          To assign someone: open their member profile, edit member info, enable
          Team Admin, and check this club.
        </p>
      </section>

      {contacts.length > 0 && (
        <section className="rs-detail-card" aria-labelledby="team-contacts">
          <h2 id="team-contacts" className="rs-detail-section__label">
            Contacts sheet
          </h2>
          <p className="rs-detail-note">
            People from the Contacts tab (rows without an email are omitted).
            Auto-link when that person signs up and requests the club.
          </p>
          <ul className="rs-member-teams">
            {contacts.map((person) => (
              <li key={person.email}>
                {person.name ? `${person.name} · ` : null}
                <a href={`mailto:${person.email}`}>{person.email}</a>
                {person.phone ? ` · ${person.phone}` : null}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rs-detail-card" aria-labelledby="team-upcoming">
        <h2 id="team-upcoming" className="rs-detail-section__label">
          Upcoming games
        </h2>
        {upcoming.length === 0 ? (
          <p className="rs-detail-note">No upcoming games scheduled.</p>
        ) : (
          <ul className="rs-list">
            {upcoming.map((m) => (
              <li key={m.id}>
                <MatchListRow
                  match={m}
                  to={`/matches/${m.id}`}
                  showTime
                  back={matchBack}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
