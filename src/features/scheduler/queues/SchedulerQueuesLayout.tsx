import { Outlet } from 'react-router-dom';
import { QueuesSubNav } from '@/features/scheduler/queues/QueuesSubNav';

/** Sub-tabs (Work queues | Crew defaults) — no duplicate page title. */
export function SchedulerQueuesLayout() {
  return (
    <div className="rs-stack">
      <QueuesSubNav />
      <Outlet />
    </div>
  );
}
