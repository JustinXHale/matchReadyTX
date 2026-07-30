import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Button,
  EmptyState,
  EmptyStateBody,
  FormGroup,
  Title,
} from '@patternfly/react-core';
import { useApp } from '@/app/AppContext';
import { statusLabel } from '@/domain/matchTransitions';
import {
  crewPeople,
  rolesNeededForMatch,
  type CrewSlot,
  type Match,
  type MatchGender,
  type MatchStatus,
} from '@/domain/types';
import { GlobalDivisionFilters } from '@/features/global/GlobalDivisionFilters';
import { appointmentMySlot } from '@/features/referee/appointments/crewLines';
import {
  SchedulerCompetitionFilter,
  useSchedulerCompetition,
} from '@/features/scheduler/SchedulerCompetitionFilter';
import type { BackNav } from '@/nav/backNav';
import { IconDateInput } from '@/ui/IconDateInput';
import { MatchCrewTrailing } from '@/ui/MatchCrewTrailing';
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

function inDateRange(kickoffAt: string, from: string, to: string): boolean {
  const t = new Date(kickoffAt).getTime();
  if (from) {
    const start = new Date(from).getTime();
    if (!Number.isNaN(start) && t < start) return false;
  }
  if (to) {
    const end = new Date(to);
    if (!Number.isNaN(end.getTime())) {
      end.setHours(23, 59, 59, 999);
      if (t > end.getTime()) return false;
    }
  }
  return true;
}

/** Assigner schedule browse — all org matches, not only released. */
export function SchedulerSchedulePage() {
  const { currentUser, state } = useApp();
  const competition = useSchedulerCompetition();
  const [genderFilter, setGenderFilter] = useState<MatchGender | null>(null);
  const [levelFilter, setLevelFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<
    MatchStatus | 'open_slots' | 'all'
  >('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const levels = state.org.matchLevels;

  const list = useMemo(() => {
    return competition
      .filterMatches(state.matches)
      .filter((m) => {
        if (genderFilter && m.gender !== genderFilter) return false;
        if (levelFilter && m.level !== levelFilter) return false;
        if (!inDateRange(m.kickoffAt, dateFrom, dateTo)) return false;
        if (statusFilter === 'open_slots') return hasOpenCrewSlot(m);
        if (statusFilter !== 'all' && m.status !== statusFilter) return false;
        return true;
      })
      .sort(
        (a, b) =>
          new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime(),
      );
  }, [
    state.matches,
    competition.selected,
    genderFilter,
    levelFilter,
    statusFilter,
    dateFrom,
    dateTo,
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
        Society matches for the selected competition. Tap a game to assign crew
        or edit.
      </p>
      <SchedulerCompetitionFilter
        options={competition.options}
        selected={competition.selected}
        setSelected={competition.setSelected}
        showControl={competition.showControl}
      />
      <Link to="/scheduler/upload">
        <Button variant="secondary" isBlock>
          Sync Sheet &amp; release drafts
        </Button>
      </Link>

      <div className="rs-date-range" role="group" aria-label="Date range">
        <FormGroup label="From" fieldId="sched-from">
          <IconDateInput
            id="sched-from"
            type="date"
            value={dateFrom}
            onChange={(_, v) => setDateFrom(v)}
          />
        </FormGroup>
        <FormGroup label="To" fieldId="sched-to">
          <IconDateInput
            id="sched-to"
            type="date"
            value={dateTo}
            onChange={(_, v) => setDateTo(v)}
          />
        </FormGroup>
      </div>

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

      <GlobalDivisionFilters
        levels={levels}
        genderFilter={genderFilter}
        levelFilter={levelFilter}
        onGenderChange={setGenderFilter}
        onLevelChange={setLevelFilter}
        ariaLabel="Filter schedule by division"
      />

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
                const mySlot = currentUser
                  ? appointmentMySlot(m, currentUser.uid)
                  : null;
                return (
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
                          highlightSlot={mySlot}
                          back={SCHEDULER_SCHEDULE_BACK}
                        />
                      }
                    />
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
