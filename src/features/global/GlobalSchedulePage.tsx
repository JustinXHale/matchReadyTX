import { Title, EmptyState, EmptyStateBody } from '@patternfly/react-core';
import { useMemo, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useApp, useAppHref } from '@/app/AppContext';
import { isKickoffUpcoming } from '@/domain/requests';
import { divisionFilterOptionsFromMatches, matchOnCalendarDate, uniqueMatchCalendarDates } from '@/domain/divisionFilters';
import { isTeamMatch, releasedMatches } from '@/domain/visibility';
import { MatchListRow } from '@/ui/MatchListRow';
import { MatchCrewTrailing } from '@/ui/MatchCrewTrailing';
import type { Match, MatchGender } from '@/domain/types';
import { GlobalDivisionFilters } from '@/features/global/GlobalDivisionFilters';
import { GlobalScheduleSubNav } from '@/features/global/GlobalScheduleSubNav';
import type { BackNav } from '@/nav/backNav';

type SchedulePane = 'upcoming' | 'completed';
type SortDir = 'asc' | 'desc';

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

function parsePane(raw: string | undefined): SchedulePane | null {
  if (raw === 'upcoming' || raw === 'completed') return raw;
  return null;
}

/** Society-wide schedule browse (bottom League tab — not Appointments → Available matches). */
export function GlobalSchedulePage() {
  const { pane: paneParam } = useParams<{ pane?: string }>();
  const pane = parsePane(paneParam);
  const { currentUser, state, isFanView } = useApp();
  const upcomingHref = useAppHref('/global/schedule/upcoming');
  const completedHref = useAppHref('/global/schedule/completed');
  const [genderFilter, setGenderFilter] = useState<MatchGender | null>(null);
  const [levelFilter, setLevelFilter] = useState<string | null>(null);
  const [competitionFilter, setCompetitionFilter] = useState<string | null>(
    null,
  );
  const [dateFilter, setDateFilter] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [myTeamsOnly, setMyTeamsOnly] = useState(false);

  const fanFavorites = currentUser?.fanTeamIds;
  const showMyTeamsChip =
    isFanView && Boolean(fanFavorites && fanFavorites.length > 0);

  const paneMatches = useMemo(() => {
    if (!pane) return [] as Match[];
    return releasedMatches(state.matches).filter((m) => {
      const upcoming = isKickoffUpcoming(m);
      if (pane === 'upcoming' && !upcoming) return false;
      if (pane === 'completed' && upcoming) return false;
      return true;
    });
  }, [state.matches, pane]);

  const filterOptions = useMemo(
    () => divisionFilterOptionsFromMatches(paneMatches, competitionFilter),
    [paneMatches, competitionFilter],
  );

  const scheduleBack: BackNav = useMemo(
    () => ({
      to: pane === 'completed' ? completedHref : upcomingHref,
      label: pane === 'completed' ? 'Completed Matches' : 'Upcoming Matches',
    }),
    [pane, completedHref, upcomingHref],
  );

  const list = useMemo(() => {
    if (!pane) return [];
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...paneMatches]
      .filter((m) => {
        if (genderFilter && m.gender !== genderFilter) return false;
        if (levelFilter && m.level !== levelFilter) return false;
        if (competitionFilter && m.competition !== competitionFilter) {
          return false;
        }
        if (!matchOnCalendarDate(m, dateFilter)) return false;
        if (myTeamsOnly && fanFavorites && fanFavorites.length > 0) {
          if (!isTeamMatch(m, fanFavorites)) return false;
        }
        return true;
      })
      .sort(
        (a, b) =>
          dir *
          (new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime()),
      );
  }, [
    paneMatches,
    genderFilter,
    levelFilter,
    competitionFilter,
    dateFilter,
    pane,
    sortDir,
    myTeamsOnly,
    fanFavorites,
  ]);

  const availableDates = useMemo(
    () =>
      uniqueMatchCalendarDates(
        paneMatches.filter((m) => {
          if (genderFilter && m.gender !== genderFilter) return false;
          if (levelFilter && m.level !== levelFilter) return false;
          if (competitionFilter && m.competition !== competitionFilter) {
            return false;
          }
          if (myTeamsOnly && fanFavorites && fanFavorites.length > 0) {
            if (!isTeamMatch(m, fanFavorites)) return false;
          }
          return true;
        }),
      ),
    [
      paneMatches,
      genderFilter,
      levelFilter,
      competitionFilter,
      myTeamsOnly,
      fanFavorites,
    ],
  );

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

  if (!pane) {
    return <Navigate to={upcomingHref} replace />;
  }

  const hasBase = releasedMatches(state.matches).length > 0;
  const emptyTitle =
    pane === 'upcoming' ? 'No upcoming matches' : 'No completed matches';
  const emptyBody =
    pane === 'upcoming'
      ? 'No upcoming released matches yet.'
      : 'No completed matches yet.';

  return (
    <>
      <GlobalScheduleSubNav />

      {hasBase && (
        <>
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
            ariaLabel="Filter schedule"
          />
          <div
            className="rs-filter-chips rs-schedule-sort"
            role="group"
            aria-label="Sort by date"
          >
            {showMyTeamsChip && (
              <button
                type="button"
                className={`rs-filter-chip${myTeamsOnly ? ' rs-filter-chip--selected' : ''}`}
                aria-pressed={myTeamsOnly}
                onClick={() => setMyTeamsOnly((v) => !v)}
              >
                My teams
              </button>
            )}
            <button
              type="button"
              className={`rs-filter-chip${sortDir === 'asc' ? ' rs-filter-chip--selected' : ''}`}
              aria-pressed={sortDir === 'asc'}
              onClick={() => setSortDir('asc')}
            >
              Date ascending
            </button>
            <button
              type="button"
              className={`rs-filter-chip${sortDir === 'desc' ? ' rs-filter-chip--selected' : ''}`}
              aria-pressed={sortDir === 'desc'}
              onClick={() => setSortDir('desc')}
            >
              Date descending
            </button>
          </div>
        </>
      )}

      {!hasBase ? (
        <EmptyState titleText="No matches" headingLevel="h3">
          <EmptyStateBody>No released matches yet.</EmptyStateBody>
        </EmptyState>
      ) : list.length === 0 ? (
        <EmptyState titleText={emptyTitle} headingLevel="h3">
          <EmptyStateBody>
            {genderFilter ||
            levelFilter ||
            competitionFilter ||
            dateFilter ||
            myTeamsOnly
              ? 'No games match these filters. Clear competition, date, or chips to widen.'
              : emptyBody}
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
                      back={scheduleBack}
                      trailing={
                        <MatchCrewTrailing
                          match={m}
                          highlightUserId={currentUser?.uid}
                          back={scheduleBack}
                        />
                      }
                    />
                  </li>
                ))}
            </ul>
          </section>
        ))
      )}
    </>
  );
}
