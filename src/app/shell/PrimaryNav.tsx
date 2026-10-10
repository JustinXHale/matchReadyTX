import { NavLink, useLocation } from 'react-router-dom';
import type { NavItem } from '@/app/shell/navItems';

export type PrimaryNavVariant = 'bar' | 'rail';

type Props = {
  items: NavItem[];
  variant: PrimaryNavVariant;
};

/**
 * Material 3 primary destinations:
 * - `bar` — Navigation bar (compact / mobile referees)
 * - `rail` — Navigation rail (medium+ windows)
 *
 * Destination order and selection identity are shared across variants.
 */
export function PrimaryNav({ items, variant }: Props) {
  const location = useLocation();
  const isBar = variant === 'bar';

  return (
    <nav
      className={
        isBar
          ? 'rs-nav-bar rs-bottom-nav'
          : 'rs-nav-rail'
      }
      aria-label="Primary"
    >
      {items.map((item) => {
        const selected = item.isActive(location.pathname);
        return (
          <NavLink
            key={item.to}
            to={item.to}
            replace
            className={() =>
              [
                'rs-nav-dest',
                isBar ? 'rs-nav-dest--bar' : 'rs-nav-dest--rail',
                selected ? 'rs-nav-dest--selected' : '',
              ]
                .filter(Boolean)
                .join(' ')
            }
            aria-current={selected ? 'page' : undefined}
            end={false}
          >
            <span className="rs-nav-dest__indicator" aria-hidden>
              {item.icon}
            </span>
            <span className="rs-nav-dest__label">{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}
