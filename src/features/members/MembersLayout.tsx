import { Outlet } from 'react-router-dom';
import { MembersSubNav } from '@/features/members/MembersSubNav';

export function MembersLayout() {
  return (
    <div className="rs-stack">
      <MembersSubNav />
      <Outlet />
    </div>
  );
}
