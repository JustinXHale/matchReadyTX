import { Outlet } from 'react-router-dom';
import { InsightsReportsSubNav } from '@/features/insights/InsightsReportsSubNav';

export function InsightsReportsLayout() {
  return (
    <div className="rs-stack">
      <InsightsReportsSubNav />
      <Outlet />
    </div>
  );
}
