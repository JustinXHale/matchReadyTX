import { useMemo } from 'react';
import { Navigate, NavLink, Outlet, useLocation } from 'react-router-dom';
import './reports/reports.css';
import { useApp, useAppHref } from '@/app/AppContext';
import { applyMatchScope } from '@/domain/visibility';
import { countPendingAppointments } from '@/features/referee/appointments/crewLines';
import {
  countReportsDue,
  countCoachingReportsDue,
  formatDueBadge,
} from '@/features/referee/reports/dueCounts';

/** Lens-aware tabs for Referee and CMO appointment/report work. */
export function RefereeLayout() {
  const { currentUser, state, roleView } = useApp();
  const location = useLocation();
  const availabilityHref = useAppHref('/referee/availability');
  const appointmentsHref = useAppHref('/referee/appointments');
  const reportsHref = useAppHref('/referee/reports');
  const coachingHref = useAppHref('/referee/reports/coaching');
  const isCmoLens = roleView === 'cmo';

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
    return isCmoLens
      ? countCoachingReportsDue(state.matchReports, currentUser.uid)
      : countReportsDue(
          state.matchReports,
          state.matches,
          state.cardReports,
          currentUser.uid,
        );
  }, [
    currentUser,
    isCmoLens,
    state.matchReports,
    state.matches,
    state.cardReports,
  ]);

  const appPath = location.pathname.replace(/^\/demo(?=\/)/, '');
  if (isCmoLens && appPath === '/referee/availability') {
    return <Navigate to={appointmentsHref} replace />;
  }
  if (
    isCmoLens &&
    appPath.startsWith('/referee/reports') &&
    !appPath.startsWith('/referee/reports/coaching')
  ) {
    return <Navigate to={coachingHref} replace />;
  }
  if (
    roleView === 'referee' &&
    appPath.startsWith('/referee/reports/coaching') &&
    appPath !== '/referee/reports/coaching/mine' &&
    appPath !== '/referee/reports/coaching/outside/new' &&
    !/^\/referee\/reports\/coaching\/[^/]+\/view$/.test(appPath) &&
    !/^\/referee\/reports\/coaching\/outside\/[^/]+\/performance$/.test(
      appPath,
    ) &&
    !/^\/referee\/reports\/coaching\/outside\/[^/]+\/coaching\/view$/.test(
      appPath,
    )
  ) {
    return <Navigate to={reportsHref} replace />;
  }

  return (
    <div className="rs-stack">
      <nav className="rs-top-tabs" aria-label={isCmoLens ? 'CMO' : 'Referee'}>
        {!isCmoLens && (
          <NavLink
            to={availabilityHref}
            className={({ isActive }) => (isActive ? 'active' : '')}
          >
            Availability
          </NavLink>
        )}
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
          to={isCmoLens ? coachingHref : reportsHref}
          className={({ isActive }) =>
            `rs-nav-with-badge${isActive ? ' active' : ''}`
          }
          aria-label={
            reportsDue > 0
              ? `${isCmoLens ? 'Coaching reports' : 'Reports'}, ${reportsDue} due`
              : isCmoLens
                ? 'Coaching reports'
                : 'Reports'
          }
        >
          {isCmoLens ? 'Coaching reports' : 'Reports'}
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
