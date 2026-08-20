import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EmptyState, EmptyStateBody, Title } from '@patternfly/react-core';
import { useApp } from '@/app/AppContext';
import {
  divisionFilterOptionsFromMatches,
  divisionFiltersActive,
  matchMatchesDivisionFilters,
  matchOnCalendarDate,
} from '@/domain/divisionFilters';
import { GlobalDivisionFilters } from '@/features/global/GlobalDivisionFilters';
import { MatchListRow } from '@/ui/MatchListRow';
import { canOfficialRequestMatch, openRequestSlots } from '@/domain/requests';
import {
  REQUESTABLE_SLOT_SHORT,
  type Match,
  type MatchGender,
  type RequestableSlot,
} from '@/domain/types';
import { backState, type BackNav } from '@/nav/backNav';

const GLOBAL_REQUEST_BACK: BackNav = {
  to: '/referee/appointments/open',
  label: 'Open',
};

type RoleFilter = 'mo' | 'ar' | 'cmo' | 'no4';

const ROLE_FILTERS: { id: RoleFilter; label: string }[] = [
  { id: 'mo', label: 'MO Only' },
  { id: 'ar', label: 'AR Only' },
  { id: 'cmo', label: 'CMO Only' },
  { id: 'no4', label: '#4 Only' },
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
  const [roleFilter, setRoleFilter] = useState<RoleFilter | null>(null);
  const [genderFilter, setGenderFilter] = useState<MatchGender | null>(null);
  const [levelFilter, setLevelFilter] = useState<string | null>(null);
  const [competitionFilter, setCompetitionFilter] = useState<string | null>(
    null,
  );
  const [dateFilter, setDateFilter] = useState<string | null>(null);

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

  const divisionActive = divisionFiltersActive({
    gender: genderFilter,
    level: levelFilter,
    competition: competitionFilter,
  });

  const matchesDivision = (m: Match) =>
    matchOnCalendarDate(m, dateFilter) &&
    (!divisionActive ||
      matchMatchesDivisionFilters(
        m,
        genderFilter,
        levelFilter,
        competitionFilter,
      ));

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

  const byMonth = useMemo(() => {
    const groups: { key: string; label: string; matches: Match[] }[] = [];
    for (const m of filteredOpen) {
      const key = monthKey(m.kickoffAt);
      const last = groups[groups.length - 1];
      if (last && last.key === key) last.matches.push(m);
      else groups.push({ key, label: monthLabel(m.kickoffAt), matches: [m] });
    }
    return groups;
  }, [filteredOpen]);

  if (!currentUser) return null;

  const hasBase = urgentMatches.length > 0 || openGames.length > 0;
  const hasAny = filteredUrgent.length > 0 || filteredOpen.length > 0;

  return (
    <div className="rs-stack">
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
        ariaLabel="Filter requestable games"
      />

      {hasBase && (
        <div
          className="rs-filter-chips"
          role="group"
          aria-label="Filter by open position"
        >
          {ROLE_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`rs-filter-chip${roleFilter === f.id ? ' rs-filter-chip--selected' : ''}`}
              aria-pressed={roleFilter === f.id}
              onClick={() =>
                setRoleFilter((prev) => (prev === f.id ? null : f.id))
              }
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {!hasBase ? (
        <EmptyState titleText="No open games" headingLevel="h3">
          <EmptyStateBody>
            There are no requestable games with open positions right now.
          </EmptyStateBody>
        </EmptyState>
      ) : !hasAny ? (
        <EmptyState titleText="No matching games" headingLevel="h3">
          <EmptyStateBody>
            No open games match this filter. Tap a chip again to clear.
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
