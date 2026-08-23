import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
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
import {
  crewPeople,
  rolesNeededForMatch,
  type CrewSlot,
  type Match,
  type MatchGender,
  type MatchStatus,
} from '@/domain/types';
import { GlobalDivisionFilters } from '@/features/global/GlobalDivisionFilters';
import { MatchCrewTrailing } from '@/ui/MatchCrewTrailing';
import type { BackNav } from '@/nav/backNav';
import { MatchListRow } from '@/ui/MatchListRow';

const SCHEDULER_SCHEDULE_BACK: BackNav = {
  to: '/scheduler/schedule',
  label: 'Schedule',
};

const STATUS_FILTERS: {
  id: MatchStatus | 'open_slots' | 'all';
  label: string;
}[] = [
  { id: 'all', label: 'All' },
  { id: 'draft', label: 'Draft' },
  { id: 'pending_team_review', label: 'Team review' },
  { id: 'crew_pending', label: 'Crew pending' },
  { id: 'needs_reassignment', label: 'Reassign' },
  { id: 'open_slots', label: 'Open slots' },
  { id: 'locked_confirmed', label: 'Locked' },
];

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

/** Named officials who have not accepted yet (crew column shows "MO Pending", etc.). */
function hasCrewAcceptancePending(m: Match): boolean {
  return namedOfficialsNeedingAvailability(m).length > 0;
}

function matchesCrewPendingFilter(m: Match): boolean {
  return m.status === 'crew_pending' || hasCrewAcceptancePending(m);
}

/** Assigner schedule browse — all org matches, not only released. */
export function SchedulerSchedulePage() {
  const { currentUser, state } = useApp();
  const [genderFilter, setGenderFilter] = useState<MatchGender | null>(null);
  const [levelFilter, setLevelFilter] = useState<string | null>(null);
  const [competitionFilter, setCompetitionFilter] = useState<string | null>(
    null,
  );
  const [statusFilter, setStatusFilter] = useState<
    MatchStatus | 'open_slots' | 'all'
  >('all');
  const [dateFilter, setDateFilter] = useState<string | null>(null);

  const filterOptions = useMemo(
    () => divisionFilterOptionsFromMatches(state.matches, competitionFilter),
    [state.matches, competitionFilter],
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
          if (statusFilter === 'open_slots') return hasOpenCrewSlot(m);
          if (statusFilter === 'crew_pending') return matchesCrewPendingFilter(m);
          if (statusFilter !== 'all' && m.status !== statusFilter) return false;
          return true;
        }),
      ),
    [
      state.matches,
      genderFilter,
      levelFilter,
      competitionFilter,
      statusFilter,
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
        if (statusFilter === 'open_slots') return hasOpenCrewSlot(m);
        if (statusFilter === 'crew_pending') return matchesCrewPendingFilter(m);
        if (statusFilter !== 'all' && m.status !== statusFilter) return false;
        return true;
      })
      .sort(compareKickoffAsc);
  }, [
    state.matches,
    genderFilter,
    levelFilter,
    competitionFilter,
    statusFilter,
    dateFilter,
  ]);

  const byMonth = useMemo(() => {
    const groups: { key: string; label: string; matches: Match[] }[] = [];
    for (const m of list) {
      const key = monthKey(m.kickoffAt);
      const last = groups[groups.length - 1];
      if (last && last.key === key) last.matches.push(m);
      else groups.push({ key, label: monthLabel(m.kickoffAt), matches: [m] });
    }
    return groups;
  }, [list]);

  return (
    <div className="rs-stack">
      <Title headingLevel="h1" size="lg">
        Schedule
      </Title>
      <p className="rs-match-card__meta">
        Society matches — filter by competition, date, level, or gender. Tap a
        game to assign crew or edit.
      </p>
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
            onClick={() => setStatusFilter(f.id)}
          >
            {f.label}
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
              {group.matches.map((m) => (
                <li key={m.id}>
                  <MatchListRow
                    match={m}
                    to={`/matches/${m.id}`}
                    showTime
                    split="action"
                    back={SCHEDULER_SCHEDULE_BACK}
                    meta={
                      <span className="rs-pill">{statusLabel(m.status)}</span>
                    }
                    trailing={
                      <MatchCrewTrailing
                        match={m}
                        highlightUserId={currentUser?.uid}
                        back={SCHEDULER_SCHEDULE_BACK}
                      />
                    }
                  />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
