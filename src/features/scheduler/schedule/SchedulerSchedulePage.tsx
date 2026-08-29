import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Button,
  EmptyState,
  EmptyStateBody,
  Title,
} from '@patternfly/react-core';
import { useApp } from '@/app/AppContext';
import { namedOfficialsNeedingAvailability } from '@/domain/crew';
import { statusLabel } from '@/domain/matchTransitions';
import {
  compareKickoffAsc,
  divisionFilterOptionsFromMatches,
  matchOnCalendarDate,
  uniqueMatchCalendarDates,
} from '@/domain/divisionFilters';
import { pendingRaiseHandRequestsForMatch } from '@/domain/requests';
import {
  crewPeople,
  rolesNeededForMatch,
  type CrewSlot,
  type Match,
  type MatchGender,
  type MatchStatus,
} from '@/domain/types';
import { GlobalDivisionFilters } from '@/features/global/GlobalDivisionFilters';
import {
  AssignOfficialModal,
  type CrewPickTarget,
} from '@/features/matches/AssignOfficialModal';
import { CoverageMatchRequesters } from '@/features/scheduler/queues/CoverageMatchRequesters';
import { useSchedulerRequestActions } from '@/features/scheduler/queues/requestQueuePagesShared';
import {
  matchesNeedingOfficials,
  matchesNeedingReassignment,
} from '@/features/scheduler/queues/selectors';
import { SchedulerAssignTrailing } from '@/features/scheduler/schedule/SchedulerAssignTrailing';
import type { BackNav } from '@/nav/backNav';
import { MatchListRow } from '@/ui/MatchListRow';
import {
  formatMatchMonthLabel,
  matchMonthKey,
  orgTimeZone,
} from '@/domain/matchTime';

const SCHEDULER_SCHEDULE_BACK: BackNav = {
  to: '/scheduler/schedule',
  label: 'Schedule',
};

type StatusFilter =
  | MatchStatus
  | 'open_slots'
  | 'needs_assignment'
  | 'all';

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'needs_assignment', label: 'Needs assignment' },
  { id: 'open_slots', label: 'Open slots' },
  { id: 'needs_reassignment', label: 'Reassign' },
  { id: 'draft', label: 'Draft' },
  { id: 'pending_team_review', label: 'Team review' },
  { id: 'crew_pending', label: 'Crew pending' },
  { id: 'locked_confirmed', label: 'Locked' },
];

function hasOpenCrewSlot(m: Match): boolean {
  const needed = rolesNeededForMatch(m);
  return needed.some((slot) => {
    if (slot === 'cmo') return !(m.cmo ?? []).some((c) => c.userId);
    if (slot === 'mo' || slot === 'ar1' || slot === 'ar2' || slot === 'no4') {
      return crewPeople(m.crew[slot as CrewSlot]).length === 0;
    }
    return false;
  });
}

function hasCrewAcceptancePending(m: Match): boolean {
  return namedOfficialsNeedingAvailability(m).length > 0;
}

function matchesCrewPendingFilter(m: Match): boolean {
  return m.status === 'crew_pending' || hasCrewAcceptancePending(m);
}

function matchNeedsAssignment(
  m: Match,
  needsOfficials: Match[],
  needsReassignment: Match[],
): boolean {
  return (
    needsOfficials.some((x) => x.id === m.id) ||
    needsReassignment.some((x) => x.id === m.id)
  );
}

function matchesScheduleStatus(
  m: Match,
  statusFilter: StatusFilter,
  needsOfficialsPool: Match[],
  needsReassignmentPool: Match[],
): boolean {
  if (statusFilter === 'open_slots') return hasOpenCrewSlot(m);
  if (statusFilter === 'crew_pending') return matchesCrewPendingFilter(m);
  if (statusFilter === 'needs_assignment') {
    return matchNeedsAssignment(m, needsOfficialsPool, needsReassignmentPool);
  }
  if (statusFilter !== 'all' && m.status !== statusFilter) return false;
  return true;
}

/** Assigner schedule — browse, filter, and assign crew from one list. */
export function SchedulerSchedulePage() {
  const { currentUser, state } = useApp();
  const { onApproveRaiseHand, onDeclineRaiseHand } =
    useSchedulerRequestActions();
  const [searchParams, setSearchParams] = useSearchParams();
  const timeZone = orgTimeZone(state.org.timezone);
  const [genderFilter, setGenderFilter] = useState<MatchGender | null>(null);
  const [levelFilter, setLevelFilter] = useState<string | null>(null);
  const [competitionFilter, setCompetitionFilter] = useState<string | null>(
    null,
  );
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(() => {
    const needs = searchParams.get('needs');
    return needs === '1' || needs === 'assignment'
      ? 'needs_assignment'
      : 'all';
  });
  const [dateFilter, setDateFilter] = useState<string | null>(null);
  const [pick, setPick] = useState<{
    match: Match;
    target: CrewPickTarget;
  } | null>(null);

  const needsOfficialsPool = useMemo(
    () => matchesNeedingOfficials(state.matches),
    [state.matches],
  );
  const needsReassignmentPool = useMemo(
    () => matchesNeedingReassignment(state.matches),
    [state.matches],
  );

  useEffect(() => {
    const needs = searchParams.get('needs');
    if (needs === '1' || needs === 'assignment') {
      setStatusFilter('needs_assignment');
    }
  }, [searchParams]);

  const filterOptions = useMemo(
    () => divisionFilterOptionsFromMatches(state.matches, competitionFilter),
    [state.matches, competitionFilter],
  );

  const matchesStatus = (m: Match) =>
    matchesScheduleStatus(
      m,
      statusFilter,
      needsOfficialsPool,
      needsReassignmentPool,
    );

  const availableDates = useMemo(
    () =>
      uniqueMatchCalendarDates(
        state.matches.filter((m) => {
          if (genderFilter && m.gender !== genderFilter) return false;
          if (levelFilter && m.level !== levelFilter) return false;
          if (competitionFilter && m.competition !== competitionFilter) {
            return false;
          }
          return matchesStatus(m);
        }),
      ),
    [
      state.matches,
      genderFilter,
      levelFilter,
      competitionFilter,
      matchesStatus,
    ],
  );

  const list = useMemo(() => {
    return state.matches
      .filter((m) => {
        if (genderFilter && m.gender !== genderFilter) return false;
        if (levelFilter && m.level !== levelFilter) return false;
        if (competitionFilter && m.competition !== competitionFilter) {
          return false;
        }
        if (!matchOnCalendarDate(m, dateFilter)) return false;
        return matchesStatus(m);
      })
      .sort(compareKickoffAsc);
  }, [
    state.matches,
    genderFilter,
    levelFilter,
    competitionFilter,
    statusFilter,
    dateFilter,
    needsOfficialsPool,
    needsReassignmentPool,
  ]);

  const byMonth = useMemo(() => {
    const groups: { key: string; label: string; matches: Match[] }[] = [];
    for (const m of list) {
      const key = matchMonthKey(m.kickoffAt, timeZone);
      const last = groups[groups.length - 1];
      if (last && last.key === key) last.matches.push(m);
      else {
        groups.push({
          key,
          label: formatMatchMonthLabel(m.kickoffAt, timeZone),
          matches: [m],
        });
      }
    }
    return groups;
  }, [list, timeZone]);

  const assignmentCount =
    needsOfficialsPool.length + needsReassignmentPool.length;

  const selectStatusFilter = (id: StatusFilter) => {
    setStatusFilter(id);
    if (id === 'needs_assignment') {
      setSearchParams({ needs: '1' }, { replace: true });
    } else if (searchParams.has('needs')) {
      setSearchParams({}, { replace: true });
    }
  };

  return (
    <div className="rs-stack">
      <Title headingLevel="h1" size="lg">
        Schedule
      </Title>
      <p className="rs-match-card__meta">
        Browse the calendar, filter by status, and tap an open position (MO,
        AR1, …) to assign. Raise-hand volunteers appear under each match.
      </p>
      {assignmentCount > 0 && statusFilter !== 'needs_assignment' ? (
        <div className="rs-schedule-coverage-callout">
          <p>
            {assignmentCount} match{assignmentCount === 1 ? '' : 'es'} need
            assignment.{' '}
            <button
              type="button"
              className="rs-link-button"
              onClick={() => selectStatusFilter('needs_assignment')}
            >
              Show needs assignment
            </button>
          </p>
        </div>
      ) : null}
      <Link to="/scheduler/upload">
        <Button variant="secondary" isBlock>
          Sync Sheet &amp; release drafts
        </Button>
      </Link>

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
        availableDates={availableDates}
        ariaLabel="Filter schedule by division"
      />

      <div className="rs-filter-chips" role="group" aria-label="Status filter">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            className={`rs-filter-chip${
              statusFilter === f.id ? ' rs-filter-chip--selected' : ''
            }`}
            onClick={() => selectStatusFilter(f.id)}
          >
            {f.label}
            {f.id === 'needs_assignment' && assignmentCount > 0
              ? ` (${assignmentCount})`
              : ''}
          </button>
        ))}
      </div>

      {state.matches.length === 0 ? (
        <EmptyState titleText="No matches" headingLevel="h3">
          <EmptyStateBody>
            Sync a schedule from Upload to get started.
          </EmptyStateBody>
        </EmptyState>
      ) : list.length === 0 ? (
        <EmptyState titleText="No matching games" headingLevel="h3">
          <EmptyStateBody>
            No games match these filters. Clear date or status chips to widen.
          </EmptyStateBody>
        </EmptyState>
      ) : (
        byMonth.map((group) => (
          <section key={group.key} className="rs-month-section">
            <Title headingLevel="h3" size="md" className="rs-month-heading">
              {group.label}
            </Title>
            <ul className="rs-list">
              {group.matches.map((m) => {
                const raiseHand = pendingRaiseHandRequestsForMatch(
                  state.requests,
                  m.id,
                );
                const urgent = needsReassignmentPool.some((x) => x.id === m.id);
                return (
                  <li
                    key={m.id}
                    className={
                      raiseHand.length > 0 ? 'rs-coverage-match' : undefined
                    }
                  >
                    <MatchListRow
                      match={m}
                      to={`/matches/${m.id}`}
                      showTime
                      split="action"
                      urgent={urgent}
                      back={SCHEDULER_SCHEDULE_BACK}
                      meta={
                        <span className="rs-pill">{statusLabel(m.status)}</span>
                      }
                      trailing={
                        <SchedulerAssignTrailing
                          match={m}
                          back={SCHEDULER_SCHEDULE_BACK}
                          highlightUserId={currentUser?.uid}
                          onPick={(target) =>
                            setPick({ match: m, target })
                          }
                        />
                      }
                    />
                    {raiseHand.length > 0 ? (
                      <CoverageMatchRequesters
                        match={m}
                        requests={raiseHand}
                        matchBack={SCHEDULER_SCHEDULE_BACK}
                        onApprove={onApproveRaiseHand}
                        onDecline={onDeclineRaiseHand}
                      />
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}

      <AssignOfficialModal
        match={pick?.match ?? null}
        pickTarget={pick?.target ?? null}
        onClose={() => setPick(null)}
      />
    </div>
  );
}
