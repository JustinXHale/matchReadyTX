import { EmptyState, EmptyStateBody, Title } from '@patternfly/react-core';
import { useMemo } from 'react';
import { useApp, useAppHref } from '@/app/AppContext';
import { divisionFilterOptionsFromMatches, matchOnCalendarDate, uniqueMatchCalendarDates } from '@/domain/divisionFilters';
import {
  matchInCompetition,
} from '@/domain/competitions';
import { globalScheduleMatches, isTeamMatch } from '@/domain/visibility';
import { MatchSummaryCard } from '@/components/MatchSummaryCard';
import { MatchCrewTrailing } from '@/ui/MatchCrewTrailing';
import { workflowMatchCardStatus } from '@/ui/matchCardStatus';
import { GlobalDivisionFilters } from '@/features/global/GlobalDivisionFilters';
import type { BackNav } from '@/nav/backNav';
import {
  pathWithSearch,
  useGlobalScheduleFilterParams,
} from '@/nav/listFilterParams';
import { orgTimeZone } from '@/domain/matchTime';
import { ScheduleMatchListWithPast } from '@/ui/ScheduleMatchListLayout';
import { useScheduleListSections } from '@/ui/useScheduleListSections';

/** Society-wide schedule browse (bottom League tab — not Appointments → Available matches). */
export function GlobalSchedulePage() {
  const { currentUser, state, isFanView } = useApp();
  const timeZone = orgTimeZone(state.org.timezone);
  const scheduleHref = useAppHref('/global/schedule');
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
  } = useGlobalScheduleFilterParams();

  const fanFavorites = currentUser?.fanTeamIds;
  const showMyTeamsChip =
    isFanView && Boolean(fanFavorites && fanFavorites.length > 0);

  const allSchedule = useMemo(
    () => globalScheduleMatches(state.matches),
    [state.matches],
  );

  const filterOptions = useMemo(
    () => divisionFilterOptionsFromMatches(allSchedule, competitionFilter),
    [allSchedule, competitionFilter],
  );

  const scheduleBack: BackNav = useMemo(() => {
    return {
      to: pathWithSearch(scheduleHref, searchParams),
      label: 'Schedule',
    };
  }, [scheduleHref, searchParams]);

  const list = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...allSchedule]
      .filter((m) => {
        if (genderFilter && m.gender !== genderFilter) return false;
        if (levelFilter && m.level !== levelFilter) return false;
        if (!matchInCompetition(m, competitionFilter)) {
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
    allSchedule,
    genderFilter,
    levelFilter,
    competitionFilter,
    dateFilter,
    sortDir,
    myTeamsOnly,
    fanFavorites,
  ]);

  const availableDates = useMemo(
    () =>
      uniqueMatchCalendarDates(
        allSchedule.filter((m) => {
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
      allSchedule,
      genderFilter,
      levelFilter,
      competitionFilter,
      myTeamsOnly,
      fanFavorites,
    ],
  );

  const collapsePast = !dateFilter;
  const { upcomingByMonth, pastByMonth, pastCount, showPastCollapsed } =
    useScheduleListSections(list, timeZone, collapsePast);

  const hasBase = allSchedule.length > 0;

  return (
    <>
      <Title headingLevel="h1" size="lg">
        Schedule
      </Title>

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
            rowEnd={
              <div className="rs-filter-field rs-schedule-sort-field">
                <span className="rs-filter-field__label">Sort</span>
                <button
                  type="button"
                  className="rs-filter-chip"
                  aria-label={`Date ${sortDir === 'asc' ? 'ascending' : 'descending'}. Activate to sort ${sortDir === 'asc' ? 'descending' : 'ascending'}.`}
                  onClick={() => setSortDir(sortDir === 'asc' ? 'desc' : 'asc')}
                >
                  Date {sortDir === 'asc' ? '↑' : '↓'}
                </button>
              </div>
            }
          />
          {showMyTeamsChip && (
            <div className="rs-filter-chips rs-schedule-sort">
              <button
                type="button"
                className={`rs-filter-chip${myTeamsOnly ? ' rs-filter-chip--selected' : ''}`}
                aria-pressed={myTeamsOnly}
                onClick={() => setMyTeamsOnly(!myTeamsOnly)}
              >
                My teams
              </button>
            </div>
          )}
        </>
      )}

      {!hasBase ? (
        <EmptyState titleText="No matches" headingLevel="h3">
          <EmptyStateBody>No released matches yet.</EmptyStateBody>
        </EmptyState>
      ) : list.length === 0 ? (
        <EmptyState titleText="No matching games" headingLevel="h3">
          <EmptyStateBody>
            {genderFilter ||
            levelFilter ||
            competitionFilter ||
            dateFilter ||
            myTeamsOnly
              ? 'No games match these filters. Clear competition, date, or chips to widen.'
              : 'No released matches yet.'}
          </EmptyStateBody>
        </EmptyState>
      ) : (
        <ScheduleMatchListWithPast
          upcomingByMonth={upcomingByMonth}
          pastByMonth={pastByMonth}
          pastCount={pastCount}
          showPastCollapsed={showPastCollapsed}
          renderMatchRow={(m) => (
            <li key={m.id}>
              <MatchSummaryCard
                match={m}
                to={`/matches/${m.id}`}
                showTime
                back={scheduleBack}
                statusPresentation={workflowMatchCardStatus(m)}
                footer={
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
      )}
    </>
  );
}
