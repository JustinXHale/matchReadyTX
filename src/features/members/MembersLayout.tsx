import { Outlet } from 'react-router-dom';
import './members.css';
import { MembersSubNav } from '@/features/members/MembersSubNav';

export function MembersLayout() {
  return (
    <div className="rs-stack">
      <MembersSubNav />
      <Outlet />
    </div>
  );
}
