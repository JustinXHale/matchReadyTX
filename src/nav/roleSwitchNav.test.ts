import { describe, expect, it } from 'vitest';
import { resolveRoleSwitchTarget } from '@/nav/roleSwitchNav';

describe('resolveRoleSwitchTarget', () => {
  it('keeps shared routes with query string', () => {
    expect(
      resolveRoleSwitchTarget(
        '/about/members/u_1',
        '',
        'scheduler',
      ),
    ).toBe('/about/members/u_1');
    expect(
      resolveRoleSwitchTarget(
        '/about/members',
        '?tab=referees&q=smith',
        'referee',
      ),
    ).toBe('/about/members?tab=referees&q=smith');
    expect(
      resolveRoleSwitchTarget(
        '/matches/T123',
        '',
        'scheduler',
      ),
    ).toBe('/matches/T123');
  });

  it('maps assigner schedule to available matches', () => {
    expect(
      resolveRoleSwitchTarget(
        '/scheduler/schedule',
        '?gender=men',
        'referee',
      ),
    ).toBe('/referee/appointments/open?gender=men');
  });

  it('maps available matches to assigner schedule', () => {
    expect(
      resolveRoleSwitchTarget(
        '/referee/appointments/open',
        '?role=mo',
        'scheduler',
      ),
    ).toBe('/scheduler/schedule?role=mo');
  });

  it('falls back to role home for lens-specific routes', () => {
    expect(
      resolveRoleSwitchTarget('/referee/reports/match', '', 'scheduler'),
    ).toBe('/scheduler');
    expect(
      resolveRoleSwitchTarget('/finance/payouts', '', 'referee'),
    ).toBe('/referee/appointments');
  });

  it('preserves demo prefix', () => {
    expect(
      resolveRoleSwitchTarget(
        '/demo/about/members/u_1',
        '',
        'scheduler',
      ),
    ).toBe('/demo/about/members/u_1');
    expect(
      resolveRoleSwitchTarget(
        '/demo/referee/appointments/open',
        '',
        'scheduler',
      ),
    ).toBe('/demo/scheduler/schedule');
  });
});
