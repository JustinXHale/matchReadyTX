import { describe, expect, it } from 'vitest';
import { resolveRoleSwitchTarget } from '@/nav/roleSwitchNav';

describe('resolveRoleSwitchTarget', () => {
  it('always navigates to the target persona home', () => {
    expect(
      resolveRoleSwitchTarget('/about/members/u_1', '', 'scheduler'),
    ).toBe('/scheduler');
    expect(
      resolveRoleSwitchTarget(
        '/about/members',
        '?tab=referees&q=smith',
        'referee',
      ),
    ).toBe('/referee/appointments');
    expect(resolveRoleSwitchTarget('/matches/T123', '', 'teamAdmin')).toBe(
      '/team-admin',
    );
    expect(resolveRoleSwitchTarget('/finance/payouts', '', 'judicial')).toBe(
      '/judicial',
    );
    expect(resolveRoleSwitchTarget('/judicial/cases/c1', '', 'cmo')).toBe(
      '/referee/appointments',
    );
    expect(resolveRoleSwitchTarget('/referee/reports/match', '', 'fan')).toBe(
      '/global/schedule',
    );
  });

  it('preserves demo prefix on role home', () => {
    expect(
      resolveRoleSwitchTarget('/demo/about/members/u_1', '', 'scheduler'),
    ).toBe('/demo/scheduler');
    expect(
      resolveRoleSwitchTarget(
        '/demo/referee/appointments/open',
        '',
        'scheduler',
      ),
    ).toBe('/demo/scheduler');
    expect(
      resolveRoleSwitchTarget('/demo/scheduler/schedule', '', 'referee'),
    ).toBe('/demo/referee/appointments');
  });
});
