import { Outlet } from 'react-router-dom';
import { InsightsOfficialsSubNav } from '@/features/insights/InsightsOfficialsSubNav';

export function InsightsOfficialsLayout() {
  return (
    <div className="rs-stack">
      <InsightsOfficialsSubNav />
      <Outlet />
    </div>
  );
}
