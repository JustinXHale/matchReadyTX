import { useMemo, useState } from 'react';
import { Title } from '@patternfly/react-core';
import { Link } from 'react-router-dom';
import { useApp, useAppHref } from '@/app/AppContext';
import { isKickoffUpcoming } from '@/domain/requests';
import { teamLinkRequestsForReviewer } from '@/domain/teamLinkRequests';
import { applyMatchScope, matchesForUser } from '@/domain/visibility';
import {
  allPartiesConfirmed,
  teamAdminListStatus,
  type Match,
  type MatchGender,
  type Team,
} from '@/domain/types';
import { GlobalDivisionFilters } from '@/features/global/GlobalDivisionFilters';
import { divisionFilterOptionsFromMatches } from '@/domain/divisionFilters';
import { TeamLinkRequestQueue } from '@/features/scheduler/queues/TeamLinkRequestQueue';
import { TeamAdminMatchRow } from '@/features/teamAdmin/TeamAdminMatchRow';
import { isFirebaseConfigured } from '@/services/firebase';
import {
  callReviewTeamLinkRequest,
  defaultOrgId,
} from '@/services/orgData';

const TEAM_ADMIN_BACK = {
  label: 'Team Admin',
  to: '/team-admin',
} as const;

type StatusFilter = 'all' | 'needs_confirm' | 'confirmed';

type ListedMatch = {
  match: Match;
  teamId: string;
  hasPendingProposal: boolean;
};

function monthKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });
}

function isActionNeeded(match: Match, hasPendingProposal: boolean): boolean {
  return teamAdminListStatus(match, hasPendingProposal).actionNeeded;
}

export function TeamAdminHomePage() {
  const { currentUser, state, store, refresh, dataMode } = useApp();
  const requestFixtureHref = useAppHref('/team-admin/request-fixture');
  const [teamFilter, setTeamFilter] = useState<string | null>(null);
  const [genderFilter, setGenderFilter] = useState<MatchGender | null>(null);
  const [teamLinkBusyId, setTeamLinkBusyId] = useState<string | null>(null);
  const [levelFilter, setLevelFilter] = useState<string | null>(null);
  const [competitionFilter, setCompetitionFilter] = useState<string | null>(
    null,
  );
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const myTeams = useMemo((): Team[] => {
    if (!currentUser) return [];
    return currentUser.teamIds
      .map((id) => state.teams.find((t) => t.id === id))
      .filter((t): t is Team => t != null);
  }, [currentUser, state.teams]);

  const linkReviews = useMemo(
    () => teamLinkRequestsForReviewer(state.teamLinkRequests, currentUser),
    [state.teamLinkRequests, currentUser],
  );

  const onReviewTeamLink = async (
    id: string,
    decision: 'approve' | 'deny',
    reason?: string,
  ) => {
    const reviewerId = currentUser?.uid;
    if (!reviewerId) return;
    setTeamLinkBusyId(id);
    try {
      if (dataMode === 'live' && isFirebaseConfigured) {
        await callReviewTeamLinkRequest({
          orgId: defaultOrgId(),
          requestId: id,
          decision,
          denyReason: reason,
        });
        refresh();
      } else {
        store.reviewTeamLinkRequest(id, reviewerId, decision, reason);
        refresh();
      }
    } catch (err) {
      console.error('Team link review failed', err);
      window.alert(
        err instanceof Error
          ? err.message
          : 'Failed to review Team Admin request.',
      );
    } finally {
      setTeamLinkBusyId(null);
    }
  };

  const filterPool = useMemo(() => {
    if (!currentUser) return [];
    return applyMatchScope(
      matchesForUser(state.matches, currentUser, 'teamAdmin'),
      currentUser,
      'mine',
      'teamAdmin',
    ).filter((m) => isKickoffUpcoming(m) && m.status !== 'cancelled');
  }, [currentUser, state.matches]);

  const filterOptions = useMemo(
    () => divisionFilterOptionsFromMatches(filterPool),
    [filterPool],
  );

  const pendingByMatch = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const p of state.proposals) {
      if (p.status === 'pending') map.set(p.matchId, true);
    }
    return map;
  }, [state.proposals]);

  const listed = useMemo((): ListedMatch[] => {
    if (!currentUser) return [];
    const visible = filterPool;

    const rows: ListedMatch[] = [];
    for (const teamId of currentUser.teamIds) {
      if (teamFilter && teamId !== teamFilter) continue;
      for (const match of visible) {
        if (match.homeTeamId !== teamId && match.awayTeamId !== teamId) {
          continue;
        }
        if (genderFilter && match.gender !== genderFilter) continue;
        if (levelFilter && match.level !== levelFilter) continue;
        if (competitionFilter && match.competition !== competitionFilter) {
          continue;
        }
        const hasPendingProposal = Boolean(pendingByMatch.get(match.id));
        const needsAction = isActionNeeded(match, hasPendingProposal);
        if (statusFilter === 'needs_confirm' && !needsAction) continue;
        if (statusFilter === 'confirmed' && needsAction) continue;
        rows.push({ match, teamId, hasPendingProposal });
      }
    }

    rows.sort((a, b) => {
      const aNeed = isActionNeeded(a.match, a.hasPendingProposal) ? 0 : 1;
      const bNeed = isActionNeeded(b.match, b.hasPendingProposal) ? 0 : 1;
      if (aNeed !== bNeed) return aNeed - bNeed;
      const aChange =
        a.hasPendingProposal || a.match.status === 'change_proposed' ? 0 : 1;
      const bChange =
        b.hasPendingProposal || b.match.status === 'change_proposed' ? 0 : 1;
      if (aChange !== bChange) return aChange - bChange;
      return (
        new Date(a.match.kickoffAt).getTime() -
        new Date(b.match.kickoffAt).getTime()
      );
    });
    return rows;
  }, [
    currentUser,
    filterPool,
    pendingByMatch,
    teamFilter,
    genderFilter,
    levelFilter,
    competitionFilter,
    statusFilter,
  ]);

  const needsAction = useMemo(
    () =>
      listed.filter(({ match, hasPendingProposal }) =>
        isActionNeeded(match, hasPendingProposal),
      ),
    [listed],
  );

  const settled = useMemo(
    () =>
      listed.filter(({ match, hasPendingProposal }) =>
        allPartiesConfirmed(match) && !hasPendingProposal,
      ),
    [listed],
  );

  const settledByTeam = useMemo(() => {
    const groups: { team: Team; matches: ListedMatch[] }[] = [];
    for (const team of myTeams) {
      if (teamFilter && team.id !== teamFilter) continue;
      const matches = settled.filter((r) => r.teamId === team.id);
      if (matches.length === 0) continue;
      groups.push({ team, matches });
    }
    return groups;
  }, [myTeams, settled, teamFilter]);

  const settledByMonthFallback = useMemo(() => {
    if (settledByTeam.length > 0) return [];
    const groups: { key: string; label: string; matches: ListedMatch[] }[] =
      [];
    for (const row of settled) {
      const key = monthKey(row.match.kickoffAt);
      const last = groups[groups.length - 1];
      if (last && last.key === key) {
        last.matches.push(row);
      } else {
        groups.push({
          key,
          label: monthLabel(row.match.kickoffAt),
          matches: [row],
        });
      }
    }
    return groups;
  }, [settled, settledByTeam.length]);

  const myFixtureRequests = useMemo(() => {
    if (!currentUser) return [];
    return state.fixtureRequests
      .filter(
        (r) =>
          r.requesterUserId === currentUser.uid ||
          currentUser.teamIds.includes(r.requesterTeamId),
      )
      .filter((r) => r.status === 'pending' || r.status === 'declined')
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
  }, [currentUser, state.fixtureRequests]);

  if (!currentUser) return null;

  const hasTeams = myTeams.length > 0;
  const empty = listed.length === 0;
  const hasFilters =
    teamFilter != null ||
    genderFilter != null ||
    levelFilter != null ||
    competitionFilter != null ||
    statusFilter !== 'all';

  return (
    <div className="rs-stack rs-team-admin-home">
      <Title headingLevel="h1">Team Admin</Title>
      <p className="rs-match-card__meta">
        Confirm kickoff details for each of your sides. Open a game to propose
        a change when something’s wrong.
      </p>

      {!hasTeams && (
        <p className="rs-match-card__meta">
          No club is linked yet. Pick teams in Profile (or during onboarding).
          Contacts email match auto-approves; otherwise your Scheduler or a
          current Team Admin reviews each request. Until then, browse as Fan.
        </p>
      )}

      {linkReviews.length > 0 && (
        <section className="rs-detail-card" aria-labelledby="ta-link-reviews">
          <h2 id="ta-link-reviews" className="rs-detail-section__label">
            Team Admin requests for your clubs
          </h2>
          <TeamLinkRequestQueue
            requests={linkReviews}
            busyId={teamLinkBusyId}
            onApprove={(id) => void onReviewTeamLink(id, 'approve')}
            onDeny={(id, reason) => void onReviewTeamLink(id, 'deny', reason)}
          />
        </section>
      )}

      {hasTeams && (
        <>
          {myTeams.length > 1 && (
            <div
              className="rs-filter-chips"
              role="group"
              aria-label="Filter by side"
            >
              {myTeams.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`rs-filter-chip${
                    teamFilter === t.id ? ' rs-filter-chip--selected' : ''
                  }`}
                  aria-pressed={teamFilter === t.id}
                  onClick={() =>
                    setTeamFilter((prev) => (prev === t.id ? null : t.id))
                  }
                >
                  {t.name}
                </button>
              ))}
            </div>
          )}

          <div
            className="rs-filter-chips"
            role="group"
            aria-label="Filter by confirmation"
          >
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'needs_confirm', label: 'Needs confirm' },
                { id: 'confirmed', label: 'Confirmed' },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                className={`rs-filter-chip${
                  statusFilter === f.id ? ' rs-filter-chip--selected' : ''
                }`}
                aria-pressed={statusFilter === f.id}
                onClick={() => setStatusFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>

          <GlobalDivisionFilters
            options={filterOptions}
            genderFilter={genderFilter}
            levelFilter={levelFilter}
            competitionFilter={competitionFilter}
            onGenderChange={setGenderFilter}
            onLevelChange={setLevelFilter}
            onCompetitionChange={setCompetitionFilter}
            ariaLabel="Filter by division"
          />

          {empty ? (
            <p className="rs-match-card__meta">
              {hasFilters
                ? 'No games match these filters. Tap a chip again to clear it.'
                : 'No upcoming games for your sides.'}
            </p>
          ) : (
            <>
              {needsAction.length > 0 && statusFilter !== 'confirmed' && (
                <section className="rs-team-admin__section">
                  <header className="rs-team-admin__section-head">
                    <h3 className="rs-team-admin__team-name">Needs confirm</h3>
                    <span className="rs-team-admin__section-meta rs-team-admin__section-meta--urgent">
                      {needsAction.length}
                    </span>
                  </header>
                  <ul className="rs-list" aria-label="Needs confirmation">
                    {needsAction.map(
                      ({ match, teamId, hasPendingProposal }) => (
                        <li key={`need-${teamId}-${match.id}`}>
                          <TeamAdminMatchRow
                            match={match}
                            teamId={teamId}
                            to={`/matches/${match.id}`}
                            back={TEAM_ADMIN_BACK}
                            hasPendingProposal={hasPendingProposal}
                          />
                        </li>
                      ),
                    )}
                  </ul>
                </section>
              )}

              {settledByTeam.map(({ team, matches }) => (
                <section key={team.id} className="rs-team-admin__section">
                  <header className="rs-team-admin__section-head">
                    <h3 className="rs-team-admin__team-name">{team.name}</h3>
                    <span className="rs-team-admin__section-meta">
                      {matches.length} confirmed
                    </span>
                  </header>
                  <ul className="rs-list">
                    {matches.map(({ match, teamId, hasPendingProposal }) => (
                      <li key={`up-${teamId}-${match.id}`}>
                        <TeamAdminMatchRow
                          match={match}
                          teamId={teamId}
                          to={`/matches/${match.id}`}
                          back={TEAM_ADMIN_BACK}
                          hasPendingProposal={hasPendingProposal}
                        />
                      </li>
                    ))}
                  </ul>
                </section>
              ))}

              {settledByMonthFallback.map((group) => (
                <section key={group.key} className="rs-month-section">
                  <Title
                    headingLevel="h3"
                    size="md"
                    className="rs-month-heading"
                  >
                    {group.label}
                  </Title>
                  <ul className="rs-list">
                    {group.matches.map(
                      ({ match, teamId, hasPendingProposal }) => (
                        <li key={`up-${teamId}-${match.id}`}>
                          <TeamAdminMatchRow
                            match={match}
                            teamId={teamId}
                            to={`/matches/${match.id}`}
                            back={TEAM_ADMIN_BACK}
                            hasPendingProposal={hasPendingProposal}
                          />
                        </li>
                      ),
                    )}
                  </ul>
                </section>
              ))}
            </>
          )}
        </>
      )}

      {myFixtureRequests.length > 0 && (
        <section className="rs-team-admin__section">
          <header className="rs-team-admin__section-head">
            <h3 className="rs-team-admin__team-name">Fixture requests</h3>
            <span className="rs-team-admin__section-meta">
              {myFixtureRequests.length}
            </span>
          </header>
          <ul className="rs-list" aria-label="Your fixture requests">
            {myFixtureRequests.map((r) => {
              const when = new Date(r.kickoffAt).toLocaleString(undefined, {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              });
              return (
                <li key={r.id} className="rs-fixture-req-row">
                  <div className="rs-fixture-req-row__main">
                    <strong>
                      {r.homeTeamName} vs {r.awayTeamName}
                    </strong>
                    <span className="rs-match-card__meta">
                      {when} · {r.venueName}
                    </span>
                    {r.status === 'declined' && r.declineReason && (
                      <span className="rs-match-card__meta">
                        Declined: {r.declineReason}
                      </span>
                    )}
                  </div>
                  <span
                    className={
                      r.status === 'pending'
                        ? 'rs-pill rs-pill--warn'
                        : 'rs-pill'
                    }
                  >
                    {r.status === 'pending' ? 'Pending' : 'Declined'}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <Link
        to={requestFixtureHref}
        className="rs-fab"
        aria-label="Request a new fixture"
      >
        <span aria-hidden>+</span>
      </Link>
    </div>
  );
}
