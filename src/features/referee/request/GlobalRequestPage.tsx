import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { EmptyState, EmptyStateBody } from '@patternfly/react-core';
import { useApp } from '@/app/AppContext';
import {
  divisionFilterOptionsFromMatches,
  divisionFiltersActive,
  matchMatchesDivisionFilters,
  matchOnCalendarDate,
  uniqueMatchCalendarDates,
} from '@/domain/divisionFilters';
import {
  matchEventTypeLabel,
  matchFormatChoiceLabel,
  matchSideChoiceLabel,
  type MatchEventType,
  type MatchFormatChoice,
  type MatchSideChoice,
} from '@/domain/matchDivision';
import { GlobalDivisionFilters } from '@/features/global/GlobalDivisionFilters';
import { RsFilterSelect } from '@/ui/RsFilterSelect';
import { MatchListRow } from '@/ui/MatchListRow';
import { canOfficialRequestMatch, openRequestSlots } from '@/domain/requests';
import {
  REQUESTABLE_SLOT_SHORT,
  type Match,
  type RequestableSlot,
} from '@/domain/types';
import { backState, type BackNav } from '@/nav/backNav';
import {
  pathWithSearch,
  useAvailableMatchesFilterParams,
  type AvailableRoleFilter,
} from '@/nav/listFilterParams';
import { orgTimeZone } from '@/domain/matchTime';
import {
  MatchMonthSections,
  PastScheduleMatchesDisclosure,
  SchedulePastOnlyHint,
} from '@/ui/ScheduleMatchListLayout';
import { useScheduleListSections } from '@/ui/useScheduleListSections';

const OPEN_MATCHES_PATH = '/referee/appointments/open';

type RoleFilter = AvailableRoleFilter;

const ROLE_FILTERS: { id: RoleFilter; label: string }[] = [
  { id: 'mo', label: 'MO Only' },
  { id: 'ar', label: 'AR Only' },
  { id: 'cmo', label: 'CMO Only' },
  { id: 'no4', label: '#4 Only' },
];

function matchHasOpenRole(match: Match, filter: RoleFilter): boolean {
  const open = openRequestSlots(match);
  if (filter === 'mo') return open.includes('mo');
  if (filter === 'ar') return open.includes('ar1') || open.includes('ar2');
  if (filter === 'cmo') return open.includes('cmo');
  return open.includes('no4');
}

function formatOpenSlots(slots: RequestableSlot[]): string {
  return slots.map((s) => REQUESTABLE_SLOT_SHORT[s]).join(' · ');
}

/** Opens match detail so the official can pick a role and raise their hand. */
function RaiseHandTrailing({
  match,
  requestBack,
}: {
  match: Match;
  requestBack: BackNav;
}) {
  const navigate = useNavigate();
  const open = openRequestSlots(match);
  return (
    <button
      type="button"
      className="rs-raise-hand-col rs-raise-hand-hit"
      aria-label="Open match to raise hand"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        navigate(`/matches/${match.id}?request=1`, {
          state: backState(requestBack),
        });
      }}
    >
      <span className="rs-raise-hand" aria-hidden>
        ✋
      </span>
      {open.length > 0 && (
        <span className="rs-raise-hand-col__open">{formatOpenSlots(open)}</span>
      )}
    </button>
  );
}

export function GlobalRequestPage() {
  const { currentUser, state } = useApp();
  const timeZone = orgTimeZone(state.org.timezone);
  const {
    searchParams,
    roleFilter,
    genderFilter,
    levelFilter,
    competitionFilter,
    formatFilter,
    eventTypeFilter,
    sideFilter,
    dateFilter,
    setRoleFilter,
    setGenderFilter,
    setLevelFilter,
    setCompetitionFilter,
    setFormatFilter,
    setEventTypeFilter,
    setSideFilter,
    setDateFilter,
  } = useAvailableMatchesFilterParams();

  const requestBack: BackNav = useMemo(
    () => ({
      to: pathWithSearch(OPEN_MATCHES_PATH, searchParams),
      label: 'Available matches',
    }),
    [searchParams],
  );

  const filterPool = useMemo(() => {
    if (!currentUser) return [] as Match[];
    const now = Date.now();
    return state.matches.filter((m) =>
      canOfficialRequestMatch(m, currentUser.uid, state.requests, now),
    );
  }, [currentUser, state.matches, state.requests]);

  const filterOptions = useMemo(
    () => divisionFilterOptionsFromMatches(filterPool, competitionFilter),
    [filterPool, competitionFilter],
  );

  const formatSelectOptions = useMemo(
    () =>
      filterOptions.formats.map((format) => ({
        value: format,
        label: matchFormatChoiceLabel(format),
      })),
    [filterOptions.formats],
  );

  const eventSelectOptions = useMemo(
    () =>
      filterOptions.eventTypes.map((eventType) => ({
        value: eventType,
        label: matchEventTypeLabel(eventType),
      })),
    [filterOptions.eventTypes],
  );

  const sideSelectOptions = useMemo(
    () =>
      filterOptions.sides.map((side) => ({
        value: side,
        label: matchSideChoiceLabel(side),
      })),
    [filterOptions.sides],
  );

  const roleSelectOptions = useMemo(
    () => ROLE_FILTERS.map((f) => ({ value: f.id, label: f.label })),
    [],
  );

  const divisionActive = divisionFiltersActive({
    gender: genderFilter,
    level: levelFilter,
    competition: competitionFilter,
    format: formatFilter,
    eventType: eventTypeFilter,
    side: sideFilter,
  });

  const matchesDivision = (m: Match) =>
    matchOnCalendarDate(m, dateFilter) &&
    (!divisionActive ||
      matchMatchesDivisionFilters(
        m,
        genderFilter,
        levelFilter,
        competitionFilter,
        formatFilter,
        eventTypeFilter,
        sideFilter,
      ));

  const availableDates = useMemo(
    () =>
      uniqueMatchCalendarDates(
        filterPool.filter((m) => {
          if (
            divisionActive &&
            !matchMatchesDivisionFilters(
              m,
              genderFilter,
              levelFilter,
              competitionFilter,
              formatFilter,
              eventTypeFilter,
              sideFilter,
            )
          ) {
            return false;
          }
          if (roleFilter && !matchHasOpenRole(m, roleFilter)) return false;
          return true;
        }),
      ),
    [
      filterPool,
      divisionActive,
      genderFilter,
      levelFilter,
      competitionFilter,
      formatFilter,
      eventTypeFilter,
      sideFilter,
      roleFilter,
    ],
  );

  const urgentMatches = useMemo(() => {
    if (!currentUser) return [] as Match[];
    const seen = new Set<string>();
    const list: Match[] = [];
    const alerts = state.officialAlerts
      .filter((a) => a.userId === currentUser.uid || a.userId === '*')
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    for (const a of alerts) {
      if (!a.matchId || seen.has(a.matchId)) continue;
      const match = state.matches.find((m) => m.id === a.matchId);
      if (!match) continue;
      if (!canOfficialRequestMatch(match, currentUser.uid, state.requests)) {
        continue;
      }
      if (!matchesDivision(match)) continue;
      seen.add(a.matchId);
      list.push(match);
    }
    return list;
  }, [
    currentUser,
    state.officialAlerts,
    state.matches,
    state.requests,
    divisionActive,
    genderFilter,
    levelFilter,
    competitionFilter,
    formatFilter,
    eventTypeFilter,
    sideFilter,
    dateFilter,
  ]);

  const urgentIds = useMemo(
    () => new Set(urgentMatches.map((m) => m.id)),
    [urgentMatches],
  );

  const openGames = useMemo(() => {
    if (!currentUser) return [] as Match[];
    const now = Date.now();
    return state.matches
      .filter(
        (m) =>
          !urgentIds.has(m.id) &&
          canOfficialRequestMatch(m, currentUser.uid, state.requests, now) &&
          matchesDivision(m),
      )
      .sort(
        (a, b) =>
          new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime(),
      );
  }, [
    currentUser,
    state.matches,
    state.requests,
    urgentIds,
    divisionActive,
    genderFilter,
    levelFilter,
    competitionFilter,
    formatFilter,
    eventTypeFilter,
    sideFilter,
    dateFilter,
  ]);

  const filteredUrgent = useMemo(
    () =>
      roleFilter
        ? urgentMatches.filter((m) => matchHasOpenRole(m, roleFilter))
        : urgentMatches,
    [urgentMatches, roleFilter],
  );

  const filteredOpen = useMemo(
    () =>
      roleFilter
        ? openGames.filter((m) => matchHasOpenRole(m, roleFilter))
        : openGames,
    [openGames, roleFilter],
  );

  const { upcomingByMonth, pastByMonth, pastCount, showPastCollapsed } =
    useScheduleListSections(filteredOpen, timeZone, !dateFilter);

  if (!currentUser) return null;

  const hasBase = urgentMatches.length > 0 || openGames.length > 0;
  const hasAny = filteredUrgent.length > 0 || filteredOpen.length > 0;

  return (
    <div className="rs-stack">
      <GlobalDivisionFilters
        className="rs-filter-bar--available-matches"
        options={filterOptions}
        genderFilter={genderFilter}
        levelFilter={levelFilter}
        competitionFilter={competitionFilter}
        onGenderChange={setGenderFilter}
        onLevelChange={setLevelFilter}
        onCompetitionChange={setCompetitionFilter}
        layout="paired"
        showSingleLevel
        stageSecondary={false}
        showDate
        dateFilter={dateFilter}
        onDateChange={setDateFilter}
        availableDates={availableDates}
        ariaLabel="Filter requestable games"
        pairRow2End={
          <RsFilterSelect
            label="Position"
            value={roleFilter}
            onChange={(next) => setRoleFilter(next as RoleFilter | null)}
            placeholder="All positions"
            options={roleSelectOptions}
          />
        }
        pairRow3={
          <RsFilterSelect
            label="Format"
            value={formatFilter}
            onChange={(next) => setFormatFilter(next as MatchFormatChoice | null)}
            placeholder="All formats"
            options={formatSelectOptions}
          />
        }
        pairRow4={
          <>
            {filterOptions.eventTypes.length > 0 && (
              <RsFilterSelect
                label="Event"
                value={eventTypeFilter}
                onChange={(next) =>
                  setEventTypeFilter(next as MatchEventType | null)
                }
                placeholder="All events"
                options={eventSelectOptions}
              />
            )}
            {filterOptions.sides.length > 0 && (
              <RsFilterSelect
                label="Side"
                value={sideFilter}
                onChange={(next) => setSideFilter(next as MatchSideChoice | null)}
                placeholder="All sides"
                options={sideSelectOptions}
              />
            )}
          </>
        }
      />

      {!hasBase ? (
        <EmptyState titleText="No available matches" headingLevel="h3">
          <EmptyStateBody>
            There are no requestable games with open positions right now.
          </EmptyStateBody>
        </EmptyState>
      ) : !hasAny ? (
        <EmptyState titleText="No matching games" headingLevel="h3">
          <EmptyStateBody>
            No available matches match this filter. Clear a dropdown to see more
            games.
          </EmptyStateBody>
        </EmptyState>
      ) : (
        <>
          {filteredUrgent.length > 0 && (
            <ul className="rs-list" aria-label="Urgent coverage">
              {filteredUrgent.map((m) => (
                <li key={`urgent-${m.id}`}>
                  <MatchListRow
                    match={m}
                    to={`/matches/${m.id}?request=1`}
                    showTime
                    split="action"
                    urgent
                    back={requestBack}
                    trailing={<RaiseHandTrailing match={m} requestBack={requestBack} />}
                  />
                </li>
              ))}
            </ul>
          )}

          <SchedulePastOnlyHint
            show={showPastCollapsed && upcomingByMonth.length === 0}
          />
          <MatchMonthSections
            groups={upcomingByMonth}
            renderMatchRow={(m) => (
              <li key={m.id}>
                <MatchListRow
                  match={m}
                  to={`/matches/${m.id}?request=1`}
                  showTime
                  split="action"
                  back={requestBack}
                  trailing={<RaiseHandTrailing match={m} requestBack={requestBack} />}
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
                    to={`/matches/${m.id}?request=1`}
                    showTime
                    split="action"
                    back={requestBack}
                    trailing={<RaiseHandTrailing match={m} requestBack={requestBack} />}
                  />
                </li>
              )}
            />
          ) : null}
        </>
      )}
    </div>
  );
}
