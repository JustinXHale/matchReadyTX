import type { UserProfile } from '@/domain/types';

function initialsFor(user: Pick<UserProfile, 'firstName' | 'lastName' | 'displayName'>): string {
  const a = user.firstName?.trim()?.[0];
  const b = user.lastName?.trim()?.[0];
  if (a && b) return `${a}${b}`.toUpperCase();
  const parts = user.displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return (parts[0]?.slice(0, 2) ?? '?').toUpperCase();
}

export function UserAvatar({
  user,
  size = 'md',
  className = '',
}: {
  user: Pick<
    UserProfile,
    'firstName' | 'lastName' | 'displayName' | 'photoUrl'
  >;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const cls = `rs-avatar${size === 'sm' ? ' rs-avatar--sm' : ''}${
    className ? ` ${className}` : ''
  }`;
  if (user.photoUrl) {
    const label =
      user.displayName?.trim() ||
      `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() ||
      'Member';
    return (
      <img
        className={cls}
        src={user.photoUrl}
        alt={label}
        width={size === 'sm' ? 32 : 56}
        height={size === 'sm' ? 32 : 56}
      />
    );
  }
  return (
    <span className={cls} aria-hidden>
      {initialsFor(user)}
    </span>
  );
}
