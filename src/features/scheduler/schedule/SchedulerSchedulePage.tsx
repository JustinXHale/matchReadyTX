import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Button,
  EmptyState,
  EmptyStateBody,
  Title,
} from '@patternfly/react-core';
import { useApp } from '@/app/AppContext';
import { isComplianceHeld } from '@/domain/complianceHold';
import { namedOfficialsNeedingAvailability } from '@/domain/crew';
import {
  compareKickoffAsc,
  divisionFilterOptionsFromMatches,
  matchOnCalendarDate,
  uniqueMatchCalendarDates,
} from '@/domain/divisionFilters';
import { matchInCompetition } from '@/domain/competitions';
import { pendingRaiseHandRequestsForMatch } from '@/domain/requests';
import {
  crewPeople,
  genderLabel,
  rolesNeededForMatch,
  type CrewSlot,
  type Match,
  type MatchGender,
} from '@/domain/types';
import {
  doubleBookedOfficialIdsForMatch,
  memberListName,
} from '@/domain/members';
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
import {
  MatchSummaryCard,
} from '@/components/MatchSummaryCard';
import { workflowMatchCardStatus } from '@/ui/matchCardStatus';
import type { BackNav } from '@/nav/backNav';
import {
  pathWithSearch,
  useSchedulerScheduleFilterParams,
  type SchedulerScheduleFilters,
  type SchedulerStatusFilter,
} from '@/nav/listFilterParams';
import { orgTimeZone } from '@/domain/matchTime';
import { ScheduleMatchListWithPast } from '@/ui/ScheduleMatchListLayout';
import { useScheduleListSections } from '@/ui/useScheduleListSections';
import { FilterDialog } from '@/ui/FilterDialog';
import { RsFilterSelect } from '@/ui/RsFilterSelect';
import { MatchFilterSummary } from '@/ui/MatchFilterSummary';

const SCHEDULER_SCHEDULE_PATH = '/scheduler/schedule';

type StatusFilter = SchedulerStatusFilter;

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'needs_assignment', label: 'Needs assignment' },
  { id: 'open_slots', label: 'Open slots' },
  { id: 'needs_reassignment', label: 'Reassign' },
  { id: 'draft', label: 'Draft' },
  { id: 'pending_team_review', label: 'Team review' },
  { id: 'crew_pending', label: 'Crew pending' },
  { id: 'compliance_hold', label: 'Locked' },
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
  if (statusFilter === 'compliance_hold') return isComplianceHeld(m);
  if (statusFilter !== 'all' && m.status !== statusFilter) return false;
  return true;
}

/** Assigner schedule — browse, filter, and assign crew from one list. */
export function SchedulerSchedulePage() {
  const { currentUser, state } = useApp();
  const { onApproveRaiseHand, onDeclineRaiseHand } =
    useSchedulerRequestActions();
  const {
    searchParams,
    genderFilter,
    levelFilter,
    competitionFilter,
    dateFilter,
    statusFilter,
    setDateFilter,
    setScheduleFilters,
  } = useSchedulerScheduleFilterParams();
  const scheduleBack: BackNav = useMemo(
    () => ({
      to: pathWithSearch(SCHEDULER_SCHEDULE_PATH, searchParams),
      label: 'Schedule',
    }),
    [searchParams],
  );
  const timeZone = orgTimeZone(state.org.timezone);
  const [pick, setPick] = useState<{
    match: Match;
    target: CrewPickTarget;
  } | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState<SchedulerScheduleFilters>(
    () => ({
      gender: genderFilter,
      level: levelFilter,
      competition: competitionFilter,
      status: statusFilter,
    }),
  );

  const needsOfficialsPool = useMemo(
    () => matchesNeedingOfficials(state.matches),
    [state.matches],
  );
  const needsReassignmentPool = useMemo(
    () => matchesNeedingReassignment(state.matches),
    [state.matches],
  );

  const filterOptions = useMemo(
    () => divisionFilterOptionsFromMatches(state.matches, competitionFilter),
    [state.matches, competitionFilter],
  );

  const matchesStatus = useCallback(
    (m: Match) =>
      matchesScheduleStatus(
        m,
        statusFilter,
        needsOfficialsPool,
        needsReassignmentPool,
      ),
    [statusFilter, needsOfficialsPool, needsReassignmentPool],
  );

  const availableDates = useMemo(
    () =>
      uniqueMatchCalendarDates(
        state.matches.filter((m) => {
          if (genderFilter && m.gender !== genderFilter) return false;
          if (levelFilter && m.level !== levelFilter) return false;
          if (!matchInCompetition(m, competitionFilter)) {
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
        if (!matchInCompetition(m, competitionFilter)) {
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
    dateFilter,
    matchesStatus,
  ]);

  const { upcomingByMonth, pastByMonth, pastCount, showPastCollapsed } =
    useScheduleListSections(list, timeZone, !dateFilter);

  const assignmentCount =
    needsOfficialsPool.length + needsReassignmentPool.length;
  const complianceHoldCount = useMemo(
    () => state.matches.filter((m) => isComplianceHeld(m)).length,
    [state.matches],
  );

  const renderScheduleMatchRow = useCallback(
    (m: Match) => {
      const raiseHand = pendingRaiseHandRequestsForMatch(
        state.requests,
        m.id,
        m,
      );
      const urgent = needsReassignmentPool.some((x) => x.id === m.id);
      const needsOpenMo =
        needsOfficialsPool.some((x) => x.id === m.id) &&
        rolesNeededForMatch(m).includes('mo') &&
        crewPeople(m.crew.mo).length === 0;
      const doubleBookedIds = doubleBookedOfficialIdsForMatch(
        state.matches,
        m,
        timeZone,
      );
      const doubleBookedNames = doubleBookedIds
        .map((uid) => {
          const user = state.users.find((u) => u.uid === uid);
          return user ? memberListName(user) : null;
        })
        .filter((name): name is string => Boolean(name));
      return (
        <li
          key={m.id}
          className={raiseHand.length > 0 ? 'rs-coverage-match' : undefined}
        >
          <MatchSummaryCard
            match={m}
            to={`/matches/${m.id}`}
            showTime
            back={scheduleBack}
            statusPresentation={workflowMatchCardStatus(m, {
              needsReassignment: urgent,
            })}
            emphasizeOfficialNeeded={needsOpenMo}
            topBanner={
              <SchedulerAssignTrailing
                match={m}
                back={scheduleBack}
                highlightUserId={currentUser?.uid}
                doubleBookedUserIds={doubleBookedIds}
                onPick={(target) => setPick({ match: m, target })}
              />
            }
            footer={
              raiseHand.length > 0 ? (
                <CoverageMatchRequesters
                  match={m}
                  requests={raiseHand}
                  matchBack={scheduleBack}
                  onApprove={onApproveRaiseHand}
                  onDecline={onDeclineRaiseHand}
                />
              ) : undefined
            }
          />
          {doubleBookedNames.length > 0 ? (
            <p className="rs-assign-overlap rs-assign-overlap--warn">
              {doubleBookedNames.join(', ')} assigned to another game this day.
            </p>
          ) : null}
        </li>
      );
    },
    [
      state.requests,
      state.matches,
      state.users,
      needsOfficialsPool,
      needsReassignmentPool,
      timeZone,
      scheduleBack,
      currentUser?.uid,
      onApproveRaiseHand,
      onDeclineRaiseHand,
    ],
  );

  const activeFilterCount = [
    genderFilter,
    levelFilter,
    competitionFilter,
    statusFilter === 'all' ? null : statusFilter,
  ].filter(Boolean).length;
  const draftOptions = divisionFilterOptionsFromMatches(
    state.matches,
    draftFilters.competition,
  );
  const openFilters = () => {
    setDraftFilters({
      gender: genderFilter,
      level: levelFilter,
      competition: competitionFilter,
      status: statusFilter,
    });
    setFiltersOpen(true);
  };

  const statusOptions = STATUS_FILTERS.filter((option) => option.id !== 'all').map(
    (option) => ({
      value: option.id,
      label:
        option.id === 'needs_assignment' && assignmentCount > 0
          ? `${option.label} (${assignmentCount})`
          : option.id === 'compliance_hold' && complianceHoldCount > 0
            ? `${option.label} (${complianceHoldCount})`
            : option.label,
    }),
  );

  return (
    <div className="rs-stack">
      <Title headingLevel="h1" size="lg">
        Games
      </Title>
      <p className="rs-match-card__meta">
        Browse the calendar, filter by status, and tap an open position (MO,
        AR1, …) to assign. Raise-hand volunteers appear under each match.
      </p>
      <Link to="/scheduler/upload">
        <Button variant="secondary" isBlock>
          Sync Sheet &amp; release drafts
        </Button>
      </Link>

      <MatchFilterSummary
        ariaLabel="Filter scheduler matches"
        dateValue={dateFilter}
        availableDates={availableDates}
        onDateChange={setDateFilter}
        activeFilterCount={activeFilterCount}
        onOpenFilters={openFilters}
      />

      <FilterDialog
        id="scheduler-match-filters"
        open={filtersOpen}
        onCancel={() => setFiltersOpen(false)}
        onClear={() =>
          setDraftFilters({
            gender: null,
            level: null,
            competition: null,
            status: 'all',
          })
        }
        onApply={() => {
          setScheduleFilters(draftFilters);
          setFiltersOpen(false);
        }}
      >
        <RsFilterSelect
          label="Competition"
          value={draftFilters.competition}
          onChange={(next) =>
            setDraftFilters((current) => ({
              ...current,
              competition: next,
              level: null,
              gender: null,
            }))
          }
          placeholder="All competitions"
          options={filterOptions.competitions.map((value) => ({
            value,
            label: value,
          }))}
        />
        <RsFilterSelect
          label="Tier"
          value={draftFilters.level}
          onChange={(next) =>
            setDraftFilters((current) => ({ ...current, level: next }))
          }
          placeholder="All tiers"
          options={draftOptions.levels.map((value) => ({ value, label: value }))}
        />
        <RsFilterSelect
          label="Gender"
          value={draftFilters.gender}
          onChange={(next) =>
            setDraftFilters((current) => ({
              ...current,
              gender: next as MatchGender | null,
            }))
          }
          placeholder="All genders"
          options={draftOptions.genders.map((value) => ({
            value,
            label: genderLabel(value),
          }))}
        />
        <RsFilterSelect
          label="Status"
          value={draftFilters.status === 'all' ? null : draftFilters.status}
          onChange={(next) =>
            setDraftFilters((current) => ({
              ...current,
              status: (next ?? 'all') as StatusFilter,
            }))
          }
          placeholder="All statuses"
          options={statusOptions}
        />
      </FilterDialog>

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
        <ScheduleMatchListWithPast
          upcomingByMonth={upcomingByMonth}
          pastByMonth={pastByMonth}
          pastCount={pastCount}
          showPastCollapsed={showPastCollapsed}
          renderMatchRow={renderScheduleMatchRow}
        />
      )}

      <AssignOfficialModal
        match={pick?.match ?? null}
        pickTarget={pick?.target ?? null}
        onClose={() => setPick(null)}
      />
    </div>
  );
}
