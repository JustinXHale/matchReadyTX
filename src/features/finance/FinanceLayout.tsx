import { NavLink, Navigate, Outlet } from 'react-router-dom';
import '@/features/insights/insights.css';
import './finance.css';
import { ROLE_HOME, useApp, useAppHref } from '@/app/AppContext';

export function FinanceLayout() {
  const { hasFinanceAccess, isFinanceView, roleView } = useApp();
  const payoutsHref = useAppHref('/finance/payouts');
  const invoicesHref = useAppHref('/finance/invoices');
  const roleHome = useAppHref(ROLE_HOME[roleView]);

  if (!hasFinanceAccess) {
    return (
      <p className="rs-match-card__meta">
        Finance tools require Treasurer access or Scheduler role. Ask a Scheduler
        to grant Treasurer on your member profile.
      </p>
    );
  }

  if (!isFinanceView) {
    return <Navigate to={roleHome} replace />;
  }

  return (
    <div className="rs-stack">
      <nav className="rs-top-tabs" aria-label="Finance">
        <NavLink
          to={payoutsHref}
          end
          className={({ isActive }) => (isActive ? 'active' : '')}
        >
          Payouts
        </NavLink>
        <NavLink
          to={invoicesHref}
          className={({ isActive }) => (isActive ? 'active' : '')}
        >
          Invoices
        </NavLink>
      </nav>
      <Outlet />
    </div>
  );
}
