import { Outlet } from 'react-router-dom';
import './insights.css';
import { InsightsSubNav } from '@/features/insights/InsightsSubNav';

export function InsightsLayout() {
  return (
    <div className="rs-stack">
      <InsightsSubNav />
      <Outlet />
    </div>
  );
}
