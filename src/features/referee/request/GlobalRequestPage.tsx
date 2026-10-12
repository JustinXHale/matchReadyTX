import { useCallback, useMemo, useState } from 'react';
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
import { matchFormatChoiceLabel, matchSideChoiceLabel } from '@/domain/matchDivision';
import { RsFilterSelect } from '@/ui/RsFilterSelect';
import { MatchSummaryCard } from '@/components/MatchSummaryCard';
import { canOfficialRequestMatch, openRequestSlots } from '@/domain/requests';
import {
  REQUESTABLE_SLOT_SHORT,
  genderLabel,
  type Match,
  type MatchGender,
  type RequestableSlot,
} from '@/domain/types';
import { backState, type BackNav } from '@/nav/backNav';
import {
  pathWithSearch,
  useAvailableMatchesFilterParams,
  type AvailableMatchesFilters,
  type AvailableRoleFilter,
} from '@/nav/listFilterParams';
import { orgTimeZone } from '@/domain/matchTime';
import { MatchActionPrompt } from '@/ui/MatchActionPrompt';
import { ScheduleMatchListWithPast } from '@/ui/ScheduleMatchListLayout';
import { useScheduleListSections } from '@/ui/useScheduleListSections';
import { FilterDialog } from '@/ui/FilterDialog';
import { MatchFilterSummary } from '@/ui/MatchFilterSummary';
import './request.css';

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

/** Full-width raise-hand prompt — opens match detail to pick a role. */
function RaiseHandPrompt({
  match,
  requestBack,
}: {
  match: Match;
  requestBack: BackNav;
}) {
  const navigate = useNavigate();
  const open = openRequestSlots(match);
  const openLabel = open.length > 0 ? formatOpenSlots(open) : 'open roles';
  return (
    <MatchActionPrompt
      message={`Raise hand for ${openLabel}?`}
      primaryLabel="✋ Raise hand"
      onPrimary={() =>
        navigate(`/matches/${match.id}?request=1`, {
          state: backState(requestBack),
        })
      }
      tone="attention"
      ariaLabel={`Raise hand for ${match.homeTeamName} versus ${match.awayTeamName}`}
    />
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
    sideFilter,
    dateFilter,
    setDateFilter,
    setAvailableFilters,
  } = useAvailableMatchesFilterParams();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draft, setDraft] = useState<AvailableMatchesFilters>(() => ({
    role: roleFilter,
    gender: genderFilter,
    level: levelFilter,
    competition: competitionFilter,
    format: formatFilter,
    side: sideFilter,
  }));

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
    () => divisionFilterOptionsFromMatches(filterPool, null),
    [filterPool],
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
    eventType: null,
    side: sideFilter,
  });

  const matchesDivision = useCallback(
    (m: Match) =>
      matchOnCalendarDate(m, dateFilter) &&
      (!divisionActive ||
        matchMatchesDivisionFilters(
          m,
          genderFilter,
          levelFilter,
          competitionFilter,
          formatFilter,
          null,
          sideFilter,
        )),
    [
      competitionFilter,
      dateFilter,
      divisionActive,
      formatFilter,
      genderFilter,
      levelFilter,
      sideFilter,
    ],
  );

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
              null,
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
    matchesDivision,
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
    matchesDivision,
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
  const activeFilterCount = [
    roleFilter,
    genderFilter,
    levelFilter,
    competitionFilter,
    formatFilter,
    sideFilter,
  ].filter(Boolean).length;
  const draftOptions = divisionFilterOptionsFromMatches(
    filterPool,
    draft.competition,
  );
  const openFilters = () => {
    setDraft({
      role: roleFilter,
      gender: genderFilter,
      level: levelFilter,
      competition: competitionFilter,
      format: formatFilter,
      side: sideFilter,
    });
    setFiltersOpen(true);
  };

  const updateDraft = <K extends keyof AvailableMatchesFilters>(
    key: K,
    value: AvailableMatchesFilters[K],
  ) => setDraft((current) => ({ ...current, [key]: value }));

  return (
    <div className="rs-stack">
      <MatchFilterSummary
        ariaLabel="Filter available matches"
        dateValue={dateFilter}
        availableDates={availableDates}
        onDateChange={setDateFilter}
        activeFilterCount={activeFilterCount}
        onOpenFilters={openFilters}
      />

      <FilterDialog
        id="available-match-filters"
        open={filtersOpen}
        onCancel={() => setFiltersOpen(false)}
        onClear={() =>
          setDraft({
            role: null,
            gender: null,
            level: null,
            competition: null,
            format: null,
            side: null,
          })
        }
        onApply={() => {
          setAvailableFilters(draft);
          setFiltersOpen(false);
        }}
      >
        <RsFilterSelect
          label="Competition"
          value={draft.competition}
          onChange={(next) =>
            setDraft((current) => ({
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
          value={draft.level}
          onChange={(next) => updateDraft('level', next)}
          placeholder="All tiers"
          options={draftOptions.levels.map((value) => ({ value, label: value }))}
        />
        <RsFilterSelect
          label="Gender"
          value={draft.gender}
          onChange={(next) =>
            updateDraft('gender', next as MatchGender | null)
          }
          placeholder="All genders"
          options={draftOptions.genders.map((value) => ({
            value,
            label: genderLabel(value),
          }))}
        />
        <RsFilterSelect
          label="Position"
          value={draft.role}
          onChange={(next) => updateDraft('role', next as RoleFilter | null)}
          placeholder="All positions"
          options={roleSelectOptions}
        />
        <RsFilterSelect
          label="Format"
          value={draft.format}
          onChange={(next) =>
            updateDraft('format', next as AvailableMatchesFilters['format'])
          }
          placeholder="All formats"
          options={draftOptions.formats.map((value) => ({
            value,
            label: matchFormatChoiceLabel(value),
          }))}
        />
        <RsFilterSelect
          label="Side"
          value={draft.side}
          onChange={(next) =>
            updateDraft('side', next as AvailableMatchesFilters['side'])
          }
          placeholder="All sides"
          options={draftOptions.sides.map((value) => ({
            value,
            label: matchSideChoiceLabel(value),
          }))}
        />
      </FilterDialog>

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
                  <MatchSummaryCard
                    match={m}
                    to={`/matches/${m.id}?request=1`}
                    showTime
                    back={requestBack}
                    statusPresentation={{
                      tone: 'declined',
                      label: 'Urgent coverage',
                    }}
                    topBanner={
                      <RaiseHandPrompt match={m} requestBack={requestBack} />
                    }
                  />
                </li>
              ))}
            </ul>
          )}

          <ScheduleMatchListWithPast
            upcomingByMonth={upcomingByMonth}
            pastByMonth={pastByMonth}
            pastCount={pastCount}
            showPastCollapsed={showPastCollapsed}
            renderMatchRow={(m) => (
              <li key={m.id}>
                <MatchSummaryCard
                  match={m}
                  to={`/matches/${m.id}?request=1`}
                  showTime
                  back={requestBack}
                  statusPresentation={{ tone: 'pending', label: 'Available' }}
                  topBanner={
                    <RaiseHandPrompt match={m} requestBack={requestBack} />
                  }
                />
              </li>
            )}
          />
        </>
      )}
    </div>
  );
}
