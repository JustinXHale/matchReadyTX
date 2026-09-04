import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EmptyState, EmptyStateBody, Title } from '@patternfly/react-core';
import { useApp } from '@/app/AppContext';
import {
  AvailableMatchesFilters,
  type AvailableMatchesFilterState,
} from '@/features/referee/request/AvailableMatchesFilters';
import {
  divisionFilterOptionsFromMatches,
  matchMatchesMultiDivisionFilters,
  matchOnCalendarDate,
  multiDivisionFiltersActive,
  uniqueMatchCalendarDates,
} from '@/domain/divisionFilters';
import { MatchListRow } from '@/ui/MatchListRow';
import { canOfficialRequestMatch, openRequestSlots } from '@/domain/requests';
import {
  REQUESTABLE_SLOT_SHORT,
  type Match,
  type RequestableSlot,
} from '@/domain/types';
import { backState, type BackNav } from '@/nav/backNav';
import {
  formatMatchMonthLabel,
  matchMonthKey,
  orgTimeZone,
} from '@/domain/matchTime';

const GLOBAL_REQUEST_BACK: BackNav = {
  to: '/referee/appointments/open',
  label: 'Available matches',
};

type RoleFilter = 'mo' | 'ar' | 'cmo' | 'no4';

const ROLE_FILTERS: { id: RoleFilter; label: string }[] = [
  { id: 'mo', label: 'MO Only' },
  { id: 'ar', label: 'AR Only' },
  { id: 'cmo', label: 'CMO Only' },
  { id: 'no4', label: '#4 Only' },
];

const EMPTY_FILTERS: AvailableMatchesFilterState = {
  date: null,
  competitions: [],
  tiers: [],
  genders: [],
  matchTypes: [],
  roles: [],
};

function matchHasOpenRole(match: Match, filter: RoleFilter): boolean {
  const open = openRequestSlots(match);
  if (filter === 'mo') return open.includes('mo');
  if (filter === 'ar') return open.includes('ar1') || open.includes('ar2');
  if (filter === 'cmo') return open.includes('cmo');
  return open.includes('no4');
}

function matchHasAnyOpenRole(match: Match, filters: RoleFilter[]): boolean {
  if (filters.length === 0) return true;
  return filters.some((filter) => matchHasOpenRole(match, filter));
}

function formatOpenSlots(slots: RequestableSlot[]): string {
  return slots.map((s) => REQUESTABLE_SLOT_SHORT[s]).join(' · ');
}

/** Opens match detail so the official can pick a role and raise their hand. */
function RaiseHandTrailing({ match }: { match: Match }) {
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
          state: backState(GLOBAL_REQUEST_BACK),
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
  const [filters, setFilters] = useState<AvailableMatchesFilterState>(EMPTY_FILTERS);

  const filterPool = useMemo(() => {
    if (!currentUser) return [] as Match[];
    const now = Date.now();
    return state.matches.filter((m) =>
      canOfficialRequestMatch(m, currentUser.uid, state.requests, now),
    );
  }, [currentUser, state.matches, state.requests]);

  const filterOptions = useMemo(
    () =>
      divisionFilterOptionsFromMatches(filterPool, filters.competitions),
    [filterPool, filters.competitions],
  );

  useEffect(() => {
    setFilters((prev) => ({
      ...prev,
      competitions: prev.competitions.filter((value) =>
        filterOptions.competitions.includes(value),
      ),
      tiers: prev.tiers.filter((value) => filterOptions.levels.includes(value)),
      genders: prev.genders.filter((value) =>
        filterOptions.genders.includes(value),
      ),
      matchTypes: prev.matchTypes.filter((value) =>
        filterOptions.matchTypes.includes(value),
      ),
    }));
  }, [filterOptions]);

  const divisionActive = multiDivisionFiltersActive({
    genders: filters.genders,
    levels: filters.tiers,
    competitions: filters.competitions,
    matchTypes: filters.matchTypes,
  });

  const matchesDivision = (m: Match) =>
    matchOnCalendarDate(m, filters.date) &&
    (!divisionActive ||
      matchMatchesMultiDivisionFilters(m, {
        genders: filters.genders,
        levels: filters.tiers,
        competitions: filters.competitions,
        matchTypes: filters.matchTypes,
      }));

  const matchesRole = (m: Match) =>
    matchHasAnyOpenRole(m, filters.roles as RoleFilter[]);

  const availableDates = useMemo(
    () =>
      uniqueMatchCalendarDates(
        filterPool.filter((m) => {
          if (
            divisionActive &&
            !matchMatchesMultiDivisionFilters(m, {
              genders: filters.genders,
              levels: filters.tiers,
              competitions: filters.competitions,
              matchTypes: filters.matchTypes,
            })
          ) {
            return false;
          }
          if (!matchesRole(m)) return false;
          return true;
        }),
      ),
    [filterPool, divisionActive, filters.genders, filters.tiers, filters.competitions, filters.matchTypes, filters.roles],
  );

  useEffect(() => {
    if (!filters.date || availableDates == null) return;
    if (!availableDates.includes(filters.date)) {
      setFilters((prev) => ({ ...prev, date: null }));
    }
  }, [availableDates, filters.date]);

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
    filters,
    divisionActive,
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
    filters,
    divisionActive,
  ]);

  const filteredUrgent = useMemo(
    () => urgentMatches.filter(matchesRole),
    [urgentMatches, filters.roles],
  );

  const filteredOpen = useMemo(
    () => openGames.filter(matchesRole),
    [openGames, filters.roles],
  );

  const byMonth = useMemo(() => {
    const groups: { key: string; label: string; matches: Match[] }[] = [];
    for (const m of filteredOpen) {
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
  }, [filteredOpen, timeZone]);

  if (!currentUser) return null;

  const hasBase = urgentMatches.length > 0 || openGames.length > 0;
  const hasAny = filteredUrgent.length > 0 || filteredOpen.length > 0;

  return (
    <div className="rs-stack">
      <AvailableMatchesFilters
        options={filterOptions}
        filters={filters}
        onFiltersChange={setFilters}
        availableDates={availableDates}
        showRoles={hasBase}
        roleOptions={ROLE_FILTERS.map((f) => ({
          value: f.id,
          label: f.label,
        }))}
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
            No available matches match these filters. Clear filters to see more
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
                    back={GLOBAL_REQUEST_BACK}
                    trailing={<RaiseHandTrailing match={m} />}
                  />
                </li>
              ))}
            </ul>
          )}

          {byMonth.map((group) => (
            <section key={group.key} className="rs-month-section">
              <Title headingLevel="h3" size="md" className="rs-month-heading">
                {group.label}
              </Title>
              <ul className="rs-list">
                {group.matches.map((m) => (
                  <li key={m.id}>
                    <MatchListRow
                      match={m}
                      to={`/matches/${m.id}?request=1`}
                      showTime
                      split="action"
                      back={GLOBAL_REQUEST_BACK}
                      trailing={<RaiseHandTrailing match={m} />}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </>
      )}
    </div>
  );
}
