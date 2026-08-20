import { Outlet } from 'react-router-dom';
import { WorkQueuesSubNav } from '@/features/scheduler/queues/WorkQueuesSubNav';

/** Tertiary tabs under Work queues — Coverage | Changes | Notifications. */
export function SchedulerQueuesWorkLayout() {
  return (
    <>
      <WorkQueuesSubNav />
      <Outlet />
    </>
  );
}
