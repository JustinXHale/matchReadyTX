import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState, EmptyStateBody, Title } from '@patternfly/react-core';
import { useApp } from '@/app/AppContext';
import {
  formatMemberScheduleHint,
  groupTeamAdminsByTeam,
  membersForTab,
  nextMatchForMember,
  rolePillsForMember,
  teamAdminMatchesGender,
  teamGendersFromMatches,
  teamNamesForUser,
  type MemberTab,
  type TeamAdminSort,
} from '@/domain/members';
import { genderLabel, type MatchGender, type UserProfile } from '@/domain/types';
import { backState } from '@/nav/backNav';
import { UserAvatar } from '@/ui/UserAvatar';

const TABS: { id: MemberTab; label: string }[] = [
  { id: 'referees', label: 'Referees' },
  { id: 'teamAdmins', label: 'Team Admins' },
  { id: 'cmos', label: 'CMOs' },
  { id: 'fans', label: 'Fans' },
];

function MemberRow({
  user,
  tab,
  teamMeta,
  scheduleHint,
}: {
  user: UserProfile;
  tab: MemberTab;
  teamMeta?: string | null;
  scheduleHint?: string | null;
}) {
  const pills = rolePillsForMember(user.roles);
  return (
    <Link
      to={`/members/${user.uid}`}
      state={backState({ to: '/members', label: 'Members' })}
      className="rs-member-row"
    >
      <UserAvatar user={user} size="md" />
      <div className="rs-member-row__body">
        <p className="rs-member-row__name">{user.displayName}</p>
        <div className="rs-label-row" aria-label="Roles">
          {pills.map((p) => (
            <span key={p} className="rs-pill rs-pill--ink rs-list-row__chip">
              {p}
            </span>
          ))}
          {!user.profileComplete && (
            <span className="rs-pill rs-list-row__chip">Incomplete</span>
          )}
          {user.refereeLevel != null && tab !== 'teamAdmins' && (
            <span className="rs-pill rs-list-row__chip">
              Level {user.refereeLevel}
            </span>
          )}
          {user.assessedLevel != null && tab !== 'teamAdmins' && (
            <span className="rs-pill rs-list-row__chip">
              Assessed {user.assessedLevel}
            </span>
          )}
        </div>
        {teamMeta != null && teamMeta !== '' && (
          <p className="rs-member-row__meta">{teamMeta}</p>
        )}
        {scheduleHint ? (
          <p className="rs-member-row__meta">{scheduleHint}</p>
        ) : null}
      </div>
    </Link>
  );
}

/**
 * Org directory — Referees | Team Admins | CMOs.
 * Address is never shown on the list (detail: assigners only).
 */
export function MembersPage() {
  const { state } = useApp();
  const [tab, setTab] = useState<MemberTab>('referees');
  const [teamAdminSort, setTeamAdminSort] =
    useState<TeamAdminSort>('contact');
  const [genderFilter, setGenderFilter] = useState<MatchGender | null>(null);

  const teamGenders = useMemo(
    () => teamGendersFromMatches(state.matches),
    [state.matches],
  );

  const members = useMemo(() => {
    let list = membersForTab(state.users, tab);
    if (tab === 'teamAdmins' && genderFilter) {
      list = list.filter((u) =>
        teamAdminMatchesGender(u, genderFilter, teamGenders),
      );
    }
    if (tab === 'teamAdmins' && teamAdminSort === 'contact') {
      return [...list].sort((a, b) =>
        a.displayName.localeCompare(b.displayName),
      );
    }
    return list;
  }, [
    state.users,
    tab,
    genderFilter,
    teamGenders,
    teamAdminSort,
  ]);

  const teamGroups = useMemo(() => {
    if (tab !== 'teamAdmins' || teamAdminSort !== 'team') return [];
    let groups = groupTeamAdminsByTeam(members, state.teams);
    if (genderFilter) {
      groups = groups.filter((g) => {
        if (g.teamId === '_none') return false;
        return teamGenders.get(g.teamId)?.has(genderFilter);
      });
    }
    return groups;
  }, [tab, teamAdminSort, members, state.teams, genderFilter, teamGenders]);

  const emptyLabel =
    TABS.find((t) => t.id === tab)?.label.toLowerCase() ?? 'members';

  return (
    <div className="rs-stack">
      <Title headingLevel="h1" size="lg">
        Members
      </Title>
      <p className="rs-match-card__meta">
        Society directory — open someone to set assessed level or remove them
        from the org.
      </p>

      <div
        className="rs-slot-picker rs-members-tabs"
        role="tablist"
        aria-label="Member type"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`rs-filter-chip${
              tab === t.id ? ' rs-filter-chip--selected' : ''
            }`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'teamAdmins' && (
        <div className="rs-members-admin-controls">
          <div
            className="rs-slot-picker"
            role="radiogroup"
            aria-label="Sort team admins"
          >
            {(
              [
                { id: 'contact', label: 'By contact' },
                { id: 'team', label: 'By team' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                role="radio"
                aria-checked={teamAdminSort === opt.id}
                className={`rs-filter-chip${
                  teamAdminSort === opt.id ? ' rs-filter-chip--selected' : ''
                }`}
                onClick={() => setTeamAdminSort(opt.id)}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div
            className="rs-filter-chips"
            role="group"
            aria-label="Filter by division"
          >
            {(['men', 'women'] as MatchGender[]).map((g) => (
              <button
                key={g}
                type="button"
                className={`rs-filter-chip${
                  genderFilter === g ? ' rs-filter-chip--selected' : ''
                }`}
                aria-pressed={genderFilter === g}
                onClick={() =>
                  setGenderFilter(genderFilter === g ? null : g)
                }
              >
                {genderLabel(g)}
              </button>
            ))}
          </div>
        </div>
      )}

      {tab === 'teamAdmins' && teamAdminSort === 'team' ? (
        teamGroups.length === 0 ? (
          <EmptyState titleText="No members" headingLevel="h3">
            <EmptyStateBody>
              No team admins
              {genderFilter
                ? ` for ${genderLabel(genderFilter).toLowerCase()} teams`
                : ''}
              .
            </EmptyStateBody>
          </EmptyState>
        ) : (
          <div className="rs-members-team-groups">
            {teamGroups.map((group) => (
              <section
                key={group.teamId}
                className="rs-members-team-group"
                aria-labelledby={`team-group-${group.teamId}`}
              >
                <h2
                  id={`team-group-${group.teamId}`}
                  className="rs-detail-section__label"
                >
                  {group.teamName}
                </h2>
                <ul className="rs-list" aria-label={group.teamName}>
                  {group.admins.map((user) => (
                    <li key={`${group.teamId}-${user.uid}`}>
                      <MemberRow user={user} tab={tab} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )
      ) : members.length === 0 ? (
        <EmptyState titleText="No members" headingLevel="h3">
          <EmptyStateBody>
            No registered {emptyLabel}
            {tab === 'teamAdmins' && genderFilter
              ? ` for ${genderLabel(genderFilter).toLowerCase()} teams`
              : ''}
            .
          </EmptyStateBody>
        </EmptyState>
      ) : (
        <ul
          className="rs-list"
          aria-label={TABS.find((t) => t.id === tab)?.label}
        >
          {members.map((user) => {
            const teams = teamNamesForUser(user, state.teams);
            const next =
              tab === 'referees' || tab === 'cmos'
                ? nextMatchForMember(state.matches, user.uid)
                : undefined;
            const scheduleHint =
              tab === 'referees' || tab === 'cmos'
                ? formatMemberScheduleHint(next)
                : null;

            return (
              <li key={user.uid}>
                <MemberRow
                  user={user}
                  tab={tab}
                  teamMeta={
                    tab === 'teamAdmins'
                      ? teams.length > 0
                        ? teams.join(' · ')
                        : 'No teams linked'
                      : null
                  }
                  scheduleHint={scheduleHint}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
