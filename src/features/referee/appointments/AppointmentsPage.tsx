import { Title, EmptyState, EmptyStateBody } from '@patternfly/react-core';
import { useMemo } from 'react';
import { useApp } from '@/app/AppContext';
import { applyMatchScope } from '@/domain/visibility';
import { MatchListRow } from '@/ui/MatchListRow';
import { MatchCrewTrailing } from '@/ui/MatchCrewTrailing';
import type { Match } from '@/domain/types';
import {
  appointmentMySlot,
  isAppointmentPendingAccept,
} from '@/features/referee/appointments/crewLines';
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
            highlightSlot={mySlot}
            back={APPOINTMENTS_BACK}
          />
        ) : null
      }
    />
  );
}

export function AppointmentsPage() {
  const { currentUser, state } = useApp();

  const list = useMemo(() => {
    if (!currentUser) return [];
    return [...applyMatchScope(state.matches, currentUser, 'mine', 'official')].sort(
      (a, b) => new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime(),
    );
  }, [currentUser, state.matches]);

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

  const empty = list.length === 0;

  return (
    <div className="rs-stack">
      {empty ? (
        <EmptyState titleText="No appointments" headingLevel="h3">
          <EmptyStateBody>
            Games you are assigned to will show up here.
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
