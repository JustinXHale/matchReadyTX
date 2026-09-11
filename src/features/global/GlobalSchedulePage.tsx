import { EmptyState, EmptyStateBody } from '@patternfly/react-core';
import { useMemo } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useApp, useAppHref } from '@/app/AppContext';
import {
  isScheduleUpcoming,
  matchMatchesCompletedOutcome,
} from '@/domain/requests';
import { divisionFilterOptionsFromMatches, matchOnCalendarDate, uniqueMatchCalendarDates } from '@/domain/divisionFilters';
import {
  competitionsForUser,
  matchInCompetition,
  uniqueDisplayedCompetitions,
} from '@/domain/competitions';
import { globalScheduleMatches, isTeamMatch } from '@/domain/visibility';
import { MatchListRow } from '@/ui/MatchListRow';
import { MatchCrewTrailing } from '@/ui/MatchCrewTrailing';
import type { Match } from '@/domain/types';
import { GlobalDivisionFilters } from '@/features/global/GlobalDivisionFilters';
import { GlobalScheduleSubNav } from '@/features/global/GlobalScheduleSubNav';
import type { BackNav } from '@/nav/backNav';
import {
  pathWithSearch,
  useGlobalScheduleFilterParams,
} from '@/nav/listFilterParams';
import { orgTimeZone } from '@/domain/matchTime';
import {
  MatchMonthSections,
  PastScheduleMatchesDisclosure,
  SchedulePastOnlyHint,
} from '@/ui/ScheduleMatchListLayout';
import { useScheduleListSections } from '@/ui/useScheduleListSections';

type SchedulePane = 'upcoming' | 'completed';

function parsePane(raw: string | undefined): SchedulePane | null {
  if (raw === 'upcoming' || raw === 'completed') return raw;
  return null;
}

/** Society-wide schedule browse (bottom League tab — not Appointments → Available matches). */
export function GlobalSchedulePage() {
  const { pane: paneParam } = useParams<{ pane?: string }>();
  const pane = parsePane(paneParam);
  const { currentUser, state, isFanView } = useApp();
  const timeZone = orgTimeZone(state.org.timezone);
  const upcomingHref = useAppHref('/global/schedule/upcoming');
  const completedHref = useAppHref('/global/schedule/completed');
  const {
    searchParams,
    genderFilter,
    levelFilter,
    competitionFilter,
    dateFilter,
    sortDir,
    myTeamsOnly,
    setGenderFilter,
    setLevelFilter,
    setCompetitionFilter,
    setDateFilter,
    setSortDir,
    setMyTeamsOnly,
    completedOutcome,
    setCompletedOutcome,
  } = useGlobalScheduleFilterParams();

  const fanFavorites = currentUser?.fanTeamIds;
  const showMyTeamsChip =
    isFanView && Boolean(fanFavorites && fanFavorites.length > 0);

  const allSchedule = useMemo(
    () => globalScheduleMatches(state.matches),
    [state.matches],
  );

  const paneMatches = useMemo(() => {
    if (!pane) return [] as Match[];
    return allSchedule.filter((m) => {
      const upcoming = isScheduleUpcoming(m);
      if (pane === 'upcoming' && !upcoming) return false;
      if (pane === 'completed' && upcoming) return false;
      return true;
    });
  }, [allSchedule, pane]);

  const filterOptions = useMemo(() => {
    const base = divisionFilterOptionsFromMatches(paneMatches, competitionFilter);
    if (pane !== 'completed') return base;
    const competitions = uniqueDisplayedCompetitions([
      ...competitionsForUser(state.org, currentUser),
      ...base.competitions,
      ...divisionFilterOptionsFromMatches(allSchedule).competitions,
    ]);
    return { ...base, competitions };
  }, [
    paneMatches,
    pane,
    allSchedule,
    competitionFilter,
    state.org,
    currentUser,
  ]);

  const scheduleBack: BackNav = useMemo(() => {
    const base = pane === 'completed' ? completedHref : upcomingHref;
    return {
      to: pathWithSearch(base, searchParams),
      label: pane === 'completed' ? 'Completed Matches' : 'Upcoming Matches',
    };
  }, [pane, completedHref, upcomingHref, searchParams]);

  const list = useMemo(() => {
    if (!pane) return [];
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...paneMatches]
      .filter((m) => {
        if (genderFilter && m.gender !== genderFilter) return false;
        if (levelFilter && m.level !== levelFilter) return false;
        if (!matchInCompetition(m, competitionFilter)) {
          return false;
        }
        if (!matchOnCalendarDate(m, dateFilter)) return false;
        if (
          pane === 'completed' &&
          !matchMatchesCompletedOutcome(m, completedOutcome)
        ) {
          return false;
        }
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
    completedOutcome,
    myTeamsOnly,
    fanFavorites,
  ]);

  const availableDates = useMemo(
    () =>
      uniqueMatchCalendarDates(
        paneMatches.filter((m) => {
          if (genderFilter && m.gender !== genderFilter) return false;
          if (levelFilter && m.level !== levelFilter) return false;
          if (!matchInCompetition(m, competitionFilter)) {
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

  const collapsePast = pane === 'upcoming' && !dateFilter;
  const { upcomingByMonth, pastByMonth, pastCount, showPastCollapsed } =
    useScheduleListSections(list, timeZone, collapsePast);

  if (!pane) {
    return <Navigate to={upcomingHref} replace />;
  }

  const hasBase = allSchedule.length > 0;
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
                onClick={() => setMyTeamsOnly(!myTeamsOnly)}
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
            {pane === 'completed' && (
              <>
                <button
                  type="button"
                  className={`rs-filter-chip${completedOutcome === 'played' ? ' rs-filter-chip--selected' : ''}`}
                  aria-pressed={completedOutcome === 'played'}
                  onClick={() =>
                    setCompletedOutcome(
                      completedOutcome === 'played' ? 'all' : 'played',
                    )
                  }
                >
                  Played matches
                </button>
                <button
                  type="button"
                  className={`rs-filter-chip${completedOutcome === 'not_played' ? ' rs-filter-chip--selected' : ''}`}
                  aria-pressed={completedOutcome === 'not_played'}
                  onClick={() =>
                    setCompletedOutcome(
                      completedOutcome === 'not_played' ? 'all' : 'not_played',
                    )
                  }
                >
                  Forfeit / cancelled
                </button>
              </>
            )}
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
            (pane === 'completed' && completedOutcome !== 'all') ||
            myTeamsOnly
              ? 'No games match these filters. Clear competition, date, or chips to widen.'
              : emptyBody}
          </EmptyStateBody>
        </EmptyState>
      ) : (
        <>
          <SchedulePastOnlyHint
            show={showPastCollapsed && upcomingByMonth.length === 0}
          />
          <MatchMonthSections
            groups={upcomingByMonth}
            renderMatchRow={(m) => (
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
            )}
          />
          {showPastCollapsed ? (
            <PastScheduleMatchesDisclosure
              groups={pastByMonth}
              count={pastCount}
              renderMatchRow={(m) => (
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
              )}
            />
          ) : null}
        </>
      )}
    </>
  );
}
