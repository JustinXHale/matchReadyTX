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
  formatMemberCityState,
  memberListName,
  officialEffectiveLevel,
  officialGradeLabel,
  officialMatchesLevelCap,
  rugbySeasonDayRange,
} from '@/domain/members';
import { ASSESSED_LEVEL_MAX, ASSESSED_LEVEL_MIN } from '@/domain/types';
import type { AvailabilityRange, Match, UserProfile } from '@/domain/types';
import { IconDateInput } from '@/ui/IconDateInput';
import { UserAvatar } from '@/ui/UserAvatar';
import '@/features/insights/insights.css';
import './official-assign-picker.css';

const LEVEL_CAPS = Array.from(
  { length: ASSESSED_LEVEL_MAX - ASSESSED_LEVEL_MIN + 1 },
  (_, i) => ASSESSED_LEVEL_MAX - i,
);

export function OfficialAssignPicker({
  officials,
  matches,
  availability,
  timeZone,
  kickoffAt,
  currentUserId,
  onPick,
}: {
  officials: UserProfile[];
  matches: Match[];
  availability: AvailabilityRange[];
  timeZone: string;
  kickoffAt: string;
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
      if (!matchesAvailabilityFilter(availStatus, availFilter)) return false;
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
      };
    })
    .sort((a, b) => {
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

  return (
    <>
      <p className="rs-official-picker__hint">
        Games show upcoming (total) in the date range — defaults to this
        season. Availability is for this kickoff.
      </p>
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
            </FormSelect>
          </FormGroup>
        </div>
        <div className="rs-insights-official-filters">
          <FormGroup
            label="From"
            fieldId="assign-games-from"
            className="rs-insights-official-filters__grade"
          >
            <IconDateInput
              id="assign-games-from"
              type="date"
              value={fromDay}
              onChange={(_, v) => setFromDay(v)}
              aria-label="Game count from date"
            />
          </FormGroup>
          <FormGroup
            label="To"
            fieldId="assign-games-to"
            className="rs-insights-official-filters__grade"
          >
            <IconDateInput
              id="assign-games-to"
              type="date"
              value={toDay}
              onChange={(_, v) => setToDay(v)}
              aria-label="Game count to date"
            />
          </FormGroup>
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="rs-match-card__meta">No officials match.</p>
      ) : (
        <ul className="rs-official-picker">
          {rows.map(({ official: o, location, availStatus, games }) => {
            const isCurrent = currentUserId === o.uid;
            const availLabel = isCurrent
              ? 'Current'
              : availabilityStatusLabel(availStatus);
            const statusLine = [availLabel, location].filter(Boolean).join(' · ');
            return (
              <li key={o.uid}>
                <button
                  type="button"
                  className={`rs-official-picker__row${
                    isCurrent ? ' rs-official-picker__row--current' : ''
                  }`}
                  onClick={() => onPick(o.uid)}
                >
                  <span className="rs-official-picker__identity">
                    <UserAvatar user={o} size="md" />
                    <span className="rs-official-picker__copy">
                      <span className="rs-official-picker__name">
                        {memberListName(o)}
                      </span>
                      <span className="rs-official-picker__grade">
                        {officialGradeLabel(o)}
                      </span>
                      <span className="rs-official-picker__status">
                        {statusLine}
                      </span>
                    </span>
                  </span>
                  <span className="rs-official-picker__games">
                    <span className="rs-official-picker__games-label">
                      Games
                    </span>
                    <span className="rs-official-picker__games-value">
                      <span>{games.upcoming}</span>
                      <span className="rs-official-picker__games-total">
                        ({games.total})
                      </span>
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
