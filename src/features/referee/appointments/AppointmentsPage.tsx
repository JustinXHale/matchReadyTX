import { Title, EmptyState, EmptyStateBody } from '@patternfly/react-core';
import { useMemo, useState } from 'react';
import { useApp } from '@/app/AppContext';
import {
  compareKickoffAsc,
  divisionFilterOptionsFromMatches,
  matchOnCalendarDate,
  uniqueMatchCalendarDates,
} from '@/domain/divisionFilters';
import { applyMatchScope } from '@/domain/visibility';
import { MatchListRow } from '@/ui/MatchListRow';
import { MatchCrewTrailing } from '@/ui/MatchCrewTrailing';
import type { Match, MatchGender } from '@/domain/types';
import {
  appointmentMySlot,
  isAppointmentPendingAccept,
} from '@/features/referee/appointments/crewLines';
import { GlobalDivisionFilters } from '@/features/global/GlobalDivisionFilters';
import type { BackNav } from '@/nav/backNav';

const APPOINTMENTS_BACK: BackNav = {
  to: '/referee/appointments',
  label: 'Assigned',
};

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

function AppointmentRow({
  match,
  userId,
  urgent,
}: {
  match: Match;
  userId: string;
  urgent?: boolean;
}) {
  const mySlot = appointmentMySlot(match, userId);
  return (
    <MatchListRow
      match={match}
      to={`/matches/${match.id}`}
      showTime
      split="appt"
      urgent={urgent}
      back={APPOINTMENTS_BACK}
      trailing={
        mySlot ? (
          <MatchCrewTrailing
            match={match}
            highlightUserId={userId}
            back={APPOINTMENTS_BACK}
          />
        ) : null
      }
    />
  );
}

export function AppointmentsPage() {
  const { currentUser, state } = useApp();
  const [genderFilter, setGenderFilter] = useState<MatchGender | null>(null);
  const [levelFilter, setLevelFilter] = useState<string | null>(null);
  const [competitionFilter, setCompetitionFilter] = useState<string | null>(
    null,
  );
  const [dateFilter, setDateFilter] = useState<string | null>(null);

  const pool = useMemo(() => {
    if (!currentUser) return [] as Match[];
    return [
      ...applyMatchScope(state.matches, currentUser, 'mine', 'official'),
    ].sort(compareKickoffAsc);
  }, [currentUser, state.matches]);

  const filterOptions = useMemo(
    () => divisionFilterOptionsFromMatches(pool, competitionFilter),
    [pool, competitionFilter],
  );

  const availableDates = useMemo(
    () =>
      uniqueMatchCalendarDates(
        pool.filter((m) => {
          if (genderFilter && m.gender !== genderFilter) return false;
          if (levelFilter && m.level !== levelFilter) return false;
          if (competitionFilter && m.competition !== competitionFilter) {
            return false;
          }
          return true;
        }),
      ),
    [pool, genderFilter, levelFilter, competitionFilter],
  );

  const list = useMemo(
    () =>
      pool.filter((m) => {
        if (genderFilter && m.gender !== genderFilter) return false;
        if (levelFilter && m.level !== levelFilter) return false;
        if (competitionFilter && m.competition !== competitionFilter) {
          return false;
        }
        return matchOnCalendarDate(m, dateFilter);
      }),
    [pool, genderFilter, levelFilter, competitionFilter, dateFilter],
  );

  const pendingAccept = useMemo(() => {
    if (!currentUser) return [] as Match[];
    return list.filter((m) => isAppointmentPendingAccept(m, currentUser.uid));
  }, [list, currentUser]);

  const confirmed = useMemo(() => {
    if (!currentUser) return [] as Match[];
    return list.filter((m) => !isAppointmentPendingAccept(m, currentUser.uid));
  }, [list, currentUser]);

  const byMonth = useMemo(() => {
    const groups: { key: string; label: string; matches: Match[] }[] = [];
    for (const m of confirmed) {
      const key = monthKey(m.kickoffAt);
      const last = groups[groups.length - 1];
      if (last && last.key === key) {
        last.matches.push(m);
      } else {
        groups.push({ key, label: monthLabel(m.kickoffAt), matches: [m] });
      }
    }
    return groups;
  }, [confirmed]);

  if (!currentUser) return null;

  const hasFilters =
    genderFilter != null ||
    levelFilter != null ||
    competitionFilter != null ||
    dateFilter != null;

  if (pool.length === 0) {
    return (
      <div className="rs-stack">
        <EmptyState titleText="No appointments" headingLevel="h3">
          <EmptyStateBody>
            Games you are assigned to will show up here.
          </EmptyStateBody>
        </EmptyState>
      </div>
    );
  }

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
        availableDates={availableDates}
        ariaLabel="Filter assigned matches"
      />

      {list.length === 0 ? (
        <EmptyState titleText="No matching games" headingLevel="h3">
          <EmptyStateBody>
            {hasFilters
              ? 'No games match these filters. Clear competition, date, or chips to widen.'
              : 'Games you are assigned to will show up here.'}
          </EmptyStateBody>
        </EmptyState>
      ) : (
        <>
          {pendingAccept.length > 0 && (
            <ul className="rs-list" aria-label="Pending acceptance">
              {pendingAccept.map((m) => (
                <li key={`pending-${m.id}`}>
                  <AppointmentRow
                    match={m}
                    userId={currentUser.uid}
                    urgent
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
                    <AppointmentRow match={m} userId={currentUser.uid} />
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
