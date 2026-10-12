import { describe, expect, it } from 'vitest';
import { navForRole } from '@/app/shell/navItems';

describe('navForRole', () => {
  it('shows Sign in instead of Profile for a signed-out demo viewer', () => {
    const items = navForRole('referee', true, false, false);
    expect(items.at(-1)?.label).toBe('Sign in');
    expect(items.at(-1)?.to).toBe('/login');
  });

  it('keeps Insights in CMO and out of Referee primary navigation', () => {
    const cmo = navForRole('cmo', false, true, true);
    const referee = navForRole('referee', false, true, true);
    expect(cmo.map((item) => item.label)).toContain('Insights');
    expect(cmo.map((item) => item.label)).toContain('CMO');
    expect(referee.map((item) => item.label)).not.toContain('Insights');
    expect(referee.map((item) => item.label)).toContain('Referee');
    expect(referee.at(-1)?.label).toBe('Profile');
  });
});
