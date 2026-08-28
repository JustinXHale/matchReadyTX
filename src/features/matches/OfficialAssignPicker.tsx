import { useMemo, useState } from 'react';
import {
  FormGroup,
  FormSelect,
  FormSelectOption,
  TextInput,
} from '@patternfly/react-core';
import {
  availabilitySortRank,
  availabilityStatusLabel,
  kickoffAvailabilityStatus,
  matchesAvailabilityFilter,
  type AssignAvailabilityFilter,
} from '@/domain/availability';
import {
  assignmentGameCountsByOfficial,
  assignmentsForMemberInDayRange,
  formatMemberCityState,
  memberListName,
  memberSlotLabel,
  officialEffectiveLevel,
  officialGradeLabel,
  officialMatchesLevelCap,
  rugbySeasonDayRange,
} from '@/domain/members';
import { formatMatchKickoff } from '@/domain/matchTime';
import { gameRequestPreferredSlots } from '@/domain/requests';
import {
  ASSESSED_LEVEL_MAX,
  ASSESSED_LEVEL_MIN,
  REQUESTABLE_SLOT_SHORT,
  type AvailabilityRange,
  type GameRequest,
  type Match,
  type UserProfile,
} from '@/domain/types';
import { RsDateField } from '@/ui/RsDateField';
import { UserAvatar } from '@/ui/UserAvatar';
import '@/features/insights/insights.css';
import './official-assign-picker.css';

const LEVEL_CAPS = Array.from(
  { length: ASSESSED_LEVEL_MAX - ASSESSED_LEVEL_MIN + 1 },
  (_, i) => ASSESSED_LEVEL_MAX - i,
);

function formatRequestSlots(request: GameRequest): string {
  const slots = gameRequestPreferredSlots(request);
  if (slots.length === 0) return 'Requested';
  return `Requested · ${slots.map((s) => REQUESTABLE_SLOT_SHORT[s]).join(', ')}`;
}

const AVAIL_FILTER_LABELS: Record<AssignAvailabilityFilter, string> = {
  all: 'All',
  available: 'Available',
  unavailable: 'Not available',
  unset: 'Not set',
  requested: 'Requested this game',
};

function buildFilterSummary(opts: {
  query: string;
  levelCap: string;
  availFilter: AssignAvailabilityFilter;
  fromDay: string;
  toDay: string;
  seasonFrom: string;
  seasonTo: string;
}): string {
  const parts: string[] = [];
  const q = opts.query.trim();
  if (q) parts.push(`“${q}”`);
  if (opts.levelCap) parts.push(`Level ${opts.levelCap}+`);
  if (opts.availFilter !== 'all') {
    parts.push(AVAIL_FILTER_LABELS[opts.availFilter]);
  }
  if (opts.fromDay !== opts.seasonFrom || opts.toDay !== opts.seasonTo) {
    parts.push(`${opts.fromDay} – ${opts.toDay}`);
  }
  return parts.length > 0 ? parts.join(' · ') : 'Defaults';
}

export function OfficialAssignPicker({
  officials,
  matches,
  availability,
  timeZone,
  kickoffAt,
  matchId,
  requests = [],
  currentUserId,
  onPick,
}: {
  officials: UserProfile[];
  matches: Match[];
  availability: AvailabilityRange[];
  timeZone: string;
  kickoffAt: string;
  /** When set, enables raise-hand request filter and badges. */
  matchId?: string;
  requests?: GameRequest[];
  currentUserId?: string;
  onPick: (userId: string) => void;
}) {
  const season = useMemo(() => rugbySeasonDayRange(timeZone), [timeZone]);
  const [query, setQuery] = useState('');
  const [levelCap, setLevelCap] = useState('');
  const [availFilter, setAvailFilter] =
    useState<AssignAvailabilityFilter>('all');
  const [fromDay, setFromDay] = useState(season.from);
  const [toDay, setToDay] = useState(season.to);
  const [expandedUid, setExpandedUid] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(true);

  const pendingByUser = useMemo(() => {
    if (!matchId) return new Map<string, GameRequest>();
    const map = new Map<string, GameRequest>();
    for (const r of requests) {
      if (r.matchId === matchId && r.status === 'pending') {
        map.set(r.userId, r);
      }
    }
    return map;
  }, [matchId, requests]);

  const gameCounts = useMemo(
    () =>
      assignmentGameCountsByOfficial(matches, {
        timeZone,
        fromDay: fromDay.trim() || null,
        toDay: toDay.trim() || null,
      }),
    [matches, timeZone, fromDay, toDay],
  );

  const cap = levelCap ? Number(levelCap) : null;
  const q = query.trim().toLowerCase();
  const rows = officials
    .filter((o) => {
      const level = officialEffectiveLevel(o);
      if (!officialMatchesLevelCap(level, cap)) return false;
      const availStatus = kickoffAvailabilityStatus(
        availability,
        o.uid,
        kickoffAt,
        timeZone,
      );
      if (
        !matchesAvailabilityFilter(availStatus, availFilter, {
          hasPendingRequest: pendingByUser.has(o.uid),
        })
      ) {
        return false;
      }
      if (!q) return true;
      const hay = `${memberListName(o)} ${o.displayName} ${level ?? ''} ${officialGradeLabel(o)}`;
      return hay.toLowerCase().includes(q);
    })
    .map((o) => {
      const availStatus = kickoffAvailabilityStatus(
        availability,
        o.uid,
        kickoffAt,
        timeZone,
      );
      return {
        official: o,
        availStatus,
        location: formatMemberCityState(o),
        games: gameCounts.get(o.uid) ?? { upcoming: 0, total: 0 },
        request: pendingByUser.get(o.uid),
      };
    })
    .sort((a, b) => {
      const aRequested = a.request ? 0 : 1;
      const bRequested = b.request ? 0 : 1;
      if (aRequested !== bRequested) return aRequested - bRequested;
      const availCmp =
        availabilitySortRank(a.availStatus) -
        availabilitySortRank(b.availStatus);
      if (availCmp !== 0) return availCmp;
      const locCmp = (a.location ?? '').localeCompare(b.location ?? '');
      if (locCmp !== 0) return locCmp;
      return memberListName(a.official).localeCompare(
        memberListName(b.official),
      );
    });

  const toggleGames = (uid: string) => {
    setExpandedUid((cur) => (cur === uid ? null : uid));
  };

  const filtersActive = useMemo(
    () =>
      query.trim().length > 0 ||
      levelCap !== '' ||
      availFilter !== 'all' ||
      fromDay !== season.from ||
      toDay !== season.to,
    [query, levelCap, availFilter, fromDay, toDay, season.from, season.to],
  );

  const filterSummary = useMemo(
    () =>
      buildFilterSummary({
        query,
        levelCap,
        availFilter,
        fromDay,
        toDay,
        seasonFrom: season.from,
        seasonTo: season.to,
      }),
    [query, levelCap, availFilter, fromDay, toDay, season.from, season.to],
  );

  const clearFilters = () => {
    setQuery('');
    setLevelCap('');
    setAvailFilter('all');
    setFromDay(season.from);
    setToDay(season.to);
  };

  return (
    <>
      <p className="rs-official-picker__hint">
        Tap <strong>Assign</strong> to place an official. Tap the games count
        to preview assignments in the date range — availability is for this
        kickoff.
      </p>
      <div className="rs-official-picker__filters-shell">
        <div className="rs-official-picker__filters-bar">
          <button
            type="button"
            className="rs-official-picker__filters-toggle"
            aria-expanded={filtersOpen}
            onClick={() => setFiltersOpen((open) => !open)}
          >
            <span className="rs-official-picker__filters-toggle-label">
              {filtersOpen ? 'Hide filters' : 'Show filters'}
            </span>
            {!filtersOpen ? (
              <span className="rs-official-picker__filters-summary">
                {filterSummary}
              </span>
            ) : null}
          </button>
          <span className="rs-official-picker__filters-meta">
            {rows.length} official{rows.length === 1 ? '' : 's'}
          </span>
        </div>
        {filtersOpen ? (
          <div className="rs-official-picker__filters">
            <TextInput
              type="search"
              value={query}
              placeholder="Search name"
              aria-label="Search officials"
              onChange={(_, v) => setQuery(v)}
            />
            <div className="rs-insights-official-filters">
              <FormGroup
                label="Level"
                fieldId="assign-level-cap"
                className="rs-insights-official-filters__grade"
              >
                <FormSelect
                  id="assign-level-cap"
                  aria-label="Filter by grade, this level and above (1 is highest)"
                  value={levelCap}
                  onChange={(_e, value) => setLevelCap(value)}
                >
                  <FormSelectOption value="" label="All levels" />
                  {LEVEL_CAPS.map((lv) => (
                    <FormSelectOption
                      key={lv}
                      value={String(lv)}
                      label={`Level ${lv} and above`}
                    />
                  ))}
                </FormSelect>
              </FormGroup>
              <FormGroup
                label="Availability"
                fieldId="assign-avail-filter"
                className="rs-insights-official-filters__grade"
              >
                <FormSelect
                  id="assign-avail-filter"
                  aria-label="Filter by availability"
                  value={availFilter}
                  onChange={(_e, value) =>
                    setAvailFilter(value as AssignAvailabilityFilter)
                  }
                >
                  <FormSelectOption value="all" label="All" />
                  <FormSelectOption value="available" label="Available" />
                  <FormSelectOption value="unavailable" label="Not available" />
                  <FormSelectOption value="unset" label="Not set" />
                  {matchId ? (
                    <FormSelectOption
                      value="requested"
                      label="Requested this game"
                    />
                  ) : null}
                </FormSelect>
              </FormGroup>
            </div>
            <div className="rs-insights-official-filters">
              <FormGroup
                label="From"
                fieldId="assign-games-from"
                className="rs-insights-official-filters__grade"
              >
                <RsDateField
                  id="assign-games-from"
                  value={fromDay}
                  aria-label="Game count from date"
                  onChange={(v) => setFromDay(v ?? '')}
                />
              </FormGroup>
              <FormGroup
                label="To"
                fieldId="assign-games-to"
                className="rs-insights-official-filters__grade"
              >
                <RsDateField
                  id="assign-games-to"
                  value={toDay}
                  aria-label="Game count to date"
                  onChange={(v) => setToDay(v ?? '')}
                />
              </FormGroup>
            </div>
            {filtersActive ? (
              <button
                type="button"
                className="rs-official-picker__filters-clear"
                onClick={clearFilters}
              >
                Clear filters
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      {rows.length === 0 ? (
        <p className="rs-match-card__meta">No officials match.</p>
      ) : (
        <ul className="rs-official-picker">
          {rows.map(({ official: o, location, availStatus, games, request }) => {
            const isCurrent = currentUserId === o.uid;
            const availLabel = isCurrent
              ? 'Current'
              : availabilityStatusLabel(availStatus);
            const statusLine = [availLabel, location].filter(Boolean).join(' · ');
            const expanded = expandedUid === o.uid;
            const assignmentList = expanded
              ? assignmentsForMemberInDayRange(matches, o.uid, {
                  timeZone,
                  fromDay: fromDay.trim() || null,
                  toDay: toDay.trim() || null,
                })
              : [];
            return (
              <li
                key={o.uid}
                className={
                  isCurrent ? 'rs-official-picker__item--current' : undefined
                }
              >
                <div
                  className={`rs-official-picker__row${
                    isCurrent ? ' rs-official-picker__row--current' : ''
                  }`}
                >
                  <button
                    type="button"
                    className="rs-official-picker__assign"
                    onClick={() => onPick(o.uid)}
                  >
                    <span className="rs-official-picker__identity">
                      <UserAvatar user={o} size="md" />
                      <span className="rs-official-picker__copy">
                        <span className="rs-official-picker__name-row">
                          <span className="rs-official-picker__name">
                            {memberListName(o)}
                          </span>
                          {request ? (
                            <span className="rs-pill rs-pill--warn rs-official-picker__request-pill">
                              {formatRequestSlots(request)}
                            </span>
                          ) : null}
                        </span>
                        <span className="rs-official-picker__grade">
                          {officialGradeLabel(o)}
                        </span>
                        <span className="rs-official-picker__status">
                          {statusLine}
                        </span>
                      </span>
                    </span>
                    <span className="rs-official-picker__assign-label">
                      Assign
                    </span>
                  </button>
                  <button
                    type="button"
                    className={`rs-official-picker__games${
                      expanded ? ' rs-official-picker__games--open' : ''
                    }`}
                    aria-expanded={expanded}
                    aria-label={`${expanded ? 'Hide' : 'Show'} assignments for ${memberListName(o)}`}
                    onClick={() => toggleGames(o.uid)}
                  >
                    <span className="rs-official-picker__games-label">
                      Games
                    </span>
                    <span className="rs-official-picker__games-value">
                      <span>{games.upcoming}</span>
                      <span className="rs-official-picker__games-total">
                        ({games.total})
                      </span>
                    </span>
                  </button>
                </div>
                {expanded ? (
                  <div className="rs-official-picker__assignments">
                    {assignmentList.length === 0 ? (
                      <p className="rs-match-card__meta">
                        No assignments in this date range.
                      </p>
                    ) : (
                      <ul className="rs-official-picker__assignment-list">
                        {assignmentList.map((m) => {
                          const slot = memberSlotLabel(m, o.uid);
                          const when = formatMatchKickoff(m.kickoffAt, timeZone, {
                            month: 'short',
                            day: 'numeric',
                          });
                          return (
                            <li key={m.id}>
                              <span className="rs-official-picker__assignment-top">
                                <span className="rs-official-picker__assignment-teams">
                                  {m.homeTeamName} vs {m.awayTeamName}
                                </span>
                                {m.level?.trim() ? (
                                  <span className="rs-pill rs-pill--ink rs-official-picker__assignment-level">
                                    {m.level.trim()}
                                  </span>
                                ) : null}
                              </span>
                              <span className="rs-match-card__meta">
                                {when}
                                {slot ? ` · ${slot}` : ''}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
