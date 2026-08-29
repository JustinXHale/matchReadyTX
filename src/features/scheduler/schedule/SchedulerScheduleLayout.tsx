import { Outlet } from 'react-router-dom';
import { ScheduleSubNav } from '@/features/scheduler/schedule/ScheduleSubNav';

/** Sub-tabs under Schedule — games, changes, requests, crew defaults. */
export function SchedulerScheduleLayout() {
  return (
    <div className="rs-stack">
      <ScheduleSubNav />
      <Outlet />
    </div>
  );
}
