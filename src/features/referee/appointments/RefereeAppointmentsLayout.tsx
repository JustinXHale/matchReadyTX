import { Outlet } from 'react-router-dom';
import { AppointmentsSubNav } from '@/features/referee/appointments/AppointmentsSubNav';

export function RefereeAppointmentsLayout() {
  return (
    <>
      <AppointmentsSubNav />
      <Outlet />
    </>
  );
}
