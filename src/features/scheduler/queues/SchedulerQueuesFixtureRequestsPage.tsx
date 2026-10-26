import { useMemo } from 'react';
import { useApp } from '@/app/AppContext';
import { compareKickoffAsc } from '@/domain/divisionFilters';
import { formatMatchKickoff, orgTimeZone } from '@/domain/matchTime';
import { GlobalDivisionFilters } from '@/features/global/GlobalDivisionFilters';
import { FixtureRequestQueue } from '@/features/scheduler/queues/FixtureRequestQueue';
import {
  pendingFixtureRequests,
  resolvedFixtureRequests,
} from '@/features/scheduler/queues/selectors';
import {
  useRequestDivisionFilters,
  useSchedulerRequestActions,
} from '@/features/scheduler/queues/requestQueuePagesShared';

export function SchedulerQueuesFixtureRequestsPage() {
  const { state } = useApp();
  const orgTz = orgTimeZone(state.org.timezone);
  const {
    genderFilter,
    setGenderFilter,
    levelFilter,
    setLevelFilter,
    competitionFilter,
    setCompetitionFilter,
    dateFilter,
    setDateFilter,
    filterOptions,
    filtersActive,
    filterFixture,
    availableDatesForFixtures,
  } = useRequestDivisionFilters(state);
  const { fixtureBusyId, onApproveFixture, onDeclineFixture } =
    useSchedulerRequestActions();

  const fixtureReqs = useMemo(
    () =>
      [...filterFixture(pendingFixtureRequests(state.fixtureRequests))].sort(
        compareKickoffAsc,
      ),
    [state.fixtureRequests, filterFixture],
  );

  const fixtureHistory = useMemo(
    () => filterFixture(resolvedFixtureRequests(state.fixtureRequests)),
    [state.fixtureRequests, filterFixture],
  );

  const reviewerName = (userId: string | undefined) => {
    if (!userId) return undefined;
    return state.users.find((u) => u.uid === userId)?.displayName;
  };

  return (
    <>
      <p className="rs-match-card__meta">
        New match proposals submitted by Team Admins for scheduler approval.
      </p>
      <GlobalDivisionFilters
        options={filterOptions}
        genderFilter={genderFilter}
        levelFilter={levelFilter}
        competitionFilter={competitionFilter}
        onGenderChange={setGenderFilter}
        onLevelChange={setLevelFilter}
        onCompetitionChange={setCompetitionFilter}
        showDate
        dateFilter={dateFilter}
        onDateChange={setDateFilter}
        availableDates={availableDatesForFixtures}
        ariaLabel="Filter fixture requests by division"
      />
      {filtersActive && fixtureReqs.length === 0 ? (
        <p className="rs-match-card__meta">
          No fixture requests for these filters. Clear competition, date, or
          chips to see everything.
        </p>
      ) : fixtureReqs.length === 0 ? (
        <p className="rs-match-card__meta">
          There are no pending fixture proposals waiting for review.
        </p>
      ) : (
        <FixtureRequestQueue
          requests={fixtureReqs}
          busyId={fixtureBusyId}
          onApprove={(id) => void onApproveFixture(id)}
          onDecline={(id, reason) => void onDeclineFixture(id, reason)}
        />
      )}

      <details className="rs-detail-tools">
        <summary id="fixture-request-history-heading">
          Fixture request history
          {fixtureHistory.length > 0 ? ` (${fixtureHistory.length})` : ''}
        </summary>
        {fixtureHistory.length === 0 ? (
          <p className="rs-match-card__meta">
            No approved or declined fixture requests yet
            {filtersActive ? ' for these filters' : ''}.
          </p>
        ) : (
          <ul className="rs-history-list">
            {fixtureHistory.map((r) => {
              const requesterTeamName =
                state.teams.find((t) => t.id === r.requesterTeamId)?.name ??
                (r.side === 'home' ? r.homeTeamName : r.awayTeamName);
              const statusLabel =
                r.status === 'approved' ? 'Approved' : 'Declined';
              const reviewedBy = reviewerName(r.reviewedByUserId);
              return (
                <li key={r.id}>
                  <strong>
                    {statusLabel} · {r.homeTeamName} vs {r.awayTeamName}
                  </strong>
                  <div className="rs-match-card__meta">
                    {formatMatchKickoff(r.kickoffAt, orgTz)}
                    {r.venueName ? ` · ${r.venueName}` : ''}
                    {' · '}
                    Requested by {r.requesterName} ({requesterTeamName})
                  </div>
                  <div className="rs-match-card__meta">
                    Submitted {new Date(r.createdAt).toLocaleString()}
                    {r.reviewedAt
                      ? ` · ${statusLabel} ${new Date(r.reviewedAt).toLocaleString()}${
                          reviewedBy ? ` by ${reviewedBy}` : ''
                        }`
                      : ''}
                    {r.declineReason ? ` · ${r.declineReason}` : ''}
                    {r.matchId ? ` · Match ${r.matchId}` : ''}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </details>
    </>
  );
}
