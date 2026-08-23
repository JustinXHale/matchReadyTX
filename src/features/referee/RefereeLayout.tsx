import { useMemo } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import './reports/reports.css';
import { useApp, useAppHref } from '@/app/AppContext';
import { applyMatchScope } from '@/domain/visibility';
import { countPendingAppointments } from '@/features/referee/appointments/crewLines';
import {
  countReportsDue,
  formatDueBadge,
} from '@/features/referee/reports/dueCounts';

/** Top tabs for the Referee/CMO bottom-nav area only. */
export function RefereeLayout() {
  const { currentUser, state } = useApp();
  const availabilityHref = useAppHref('/referee/availability');
  const appointmentsHref = useAppHref('/referee/appointments');
  const reportsHref = useAppHref('/referee/reports');

  const appointmentsPending = useMemo(() => {
    if (!currentUser) return 0;
    const mine = applyMatchScope(
      state.matches,
      currentUser,
      'mine',
      'official',
    );
    return countPendingAppointments(mine, currentUser.uid);
  }, [currentUser, state.matches]);

  const reportsDue = useMemo(() => {
    if (!currentUser) return 0;
    return countReportsDue(
      state.matchReports,
      state.matches,
      state.cardReports,
      currentUser.uid,
    );
  }, [
    currentUser,
    state.matchReports,
    state.matches,
    state.cardReports,
  ]);

  return (
    <div className="rs-stack">
      <nav className="rs-top-tabs" aria-label="Referee/CMO">
        <NavLink
          to={availabilityHref}
          className={({ isActive }) => (isActive ? 'active' : '')}
        >
          Availability
        </NavLink>
        <NavLink
          to={appointmentsHref}
          className={({ isActive }) =>
            `rs-nav-with-badge${isActive ? ' active' : ''}`
          }
          aria-label={
            appointmentsPending > 0
              ? `Appointments, ${appointmentsPending} pending acceptance`
              : 'Appointments'
          }
        >
          Appointments
          {appointmentsPending > 0 && (
            <span className="rs-nav-badge rs-nav-badge--inline" aria-hidden>
              {formatDueBadge(appointmentsPending)}
            </span>
          )}
        </NavLink>
        <NavLink
          to={reportsHref}
          className={({ isActive }) =>
            `rs-nav-with-badge${isActive ? ' active' : ''}`
          }
          aria-label={
            reportsDue > 0
              ? `Reports, ${reportsDue} due`
              : 'Reports'
          }
        >
          Reports
          {reportsDue > 0 && (
            <span className="rs-nav-badge rs-nav-badge--inline" aria-hidden>
              {formatDueBadge(reportsDue)}
            </span>
          )}
        </NavLink>
      </nav>
      <Outlet />
    </div>
  );
}
