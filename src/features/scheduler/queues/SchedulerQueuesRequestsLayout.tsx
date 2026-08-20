import { Outlet } from 'react-router-dom';
import { RequestsQueuesSubNav } from '@/features/scheduler/queues/RequestsQueuesSubNav';

/** Tertiary tabs under Requests — Raise-hand | Fixtures | Team links. */
export function SchedulerQueuesRequestsLayout() {
  return (
    <>
      <RequestsQueuesSubNav />
      <Outlet />
    </>
  );
}
