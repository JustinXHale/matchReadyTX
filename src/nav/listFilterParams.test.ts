import { describe, expect, it } from 'vitest';
import {
  applyAvailableMatchesFilters,
  applySchedulerScheduleFilters,
  parseAvailableRoleParam,
  parseGenderParam,
  parseMemberTabParam,
  parseSchedulerStatusParam,
  patchSearchParam,
  pathWithSearch,
} from '@/nav/listFilterParams';

describe('parseGenderParam', () => {
  it('accepts men and women', () => {
    expect(parseGenderParam('men')).toBe('men');
    expect(parseGenderParam('women')).toBe('women');
  });

  it('rejects invalid values', () => {
    expect(parseGenderParam('')).toBeNull();
    expect(parseGenderParam('boys')).toBeNull();
  });
});

describe('parseSchedulerStatusParam', () => {
  it('reads legacy needs param', () => {
    expect(parseSchedulerStatusParam(null, '1')).toBe('needs_assignment');
    expect(parseSchedulerStatusParam(null, 'assignment')).toBe(
      'needs_assignment',
    );
  });

  it('prefers explicit status', () => {
    expect(parseSchedulerStatusParam('open_slots', '1')).toBe('open_slots');
  });

  it('accepts compliance hold filter and legacy locked_confirmed alias', () => {
    expect(parseSchedulerStatusParam('compliance_hold', null)).toBe(
      'compliance_hold',
    );
    expect(parseSchedulerStatusParam('locked_confirmed', null)).toBe(
      'compliance_hold',
    );
  });
});

describe('parseAvailableRoleParam', () => {
  it('accepts crew role filters', () => {
    expect(parseAvailableRoleParam('mo')).toBe('mo');
    expect(parseAvailableRoleParam('ar')).toBe('ar');
  });
});

describe('applyAvailableMatchesFilters', () => {
  it('applies the draft in one URL state and removes the retired event filter', () => {
    const params = new URLSearchParams('date=2026-10-10&event=league&role=ar');
    applyAvailableMatchesFilters(params, {
      role: 'mo',
      gender: 'women',
      level: 'Tier 2',
      competition: 'Lonestar Women',
      format: null,
      side: '1st',
    });
    expect(params.get('date')).toBe('2026-10-10');
    expect(params.get('role')).toBe('mo');
    expect(params.get('gender')).toBe('women');
    expect(params.get('level')).toBe('Tier 2');
    expect(params.get('competition')).toBe('Lonestar Women');
    expect(params.get('side')).toBe('1st');
    expect(params.has('format')).toBe(false);
    expect(params.has('event')).toBe(false);
  });
});

describe('applySchedulerScheduleFilters', () => {
  it('applies modal filters together while preserving the visible date filter', () => {
    const params = new URLSearchParams(
      'date=2026-10-10&needs=1&status=draft',
    );
    applySchedulerScheduleFilters(params, {
      gender: 'women',
      level: 'Tier 1',
      competition: 'Lonestar Women',
      status: 'needs_assignment',
    });
    expect(params.get('date')).toBe('2026-10-10');
    expect(params.get('gender')).toBe('women');
    expect(params.get('level')).toBe('Tier 1');
    expect(params.get('competition')).toBe('Lonestar Women');
    expect(params.get('status')).toBe('needs_assignment');
    expect(params.has('needs')).toBe(false);
  });
});

describe('parseMemberTabParam', () => {
  it('defaults to referees', () => {
    expect(parseMemberTabParam(null)).toBe('referees');
    expect(parseMemberTabParam('cmos')).toBe('cmos');
  });
});

describe('pathWithSearch', () => {
  it('appends query string when present', () => {
    const params = new URLSearchParams({ gender: 'men', date: '2026-09-04' });
    expect(pathWithSearch('/global/schedule', params)).toBe(
      '/global/schedule?gender=men&date=2026-09-04',
    );
  });

  it('returns path alone when empty', () => {
    expect(pathWithSearch('/about/members', new URLSearchParams())).toBe(
      '/about/members',
    );
  });
});

describe('patchSearchParam', () => {
  it('sets and clears keys', () => {
    const sp = new URLSearchParams('gender=men');
    patchSearchParam(sp, 'gender', null);
    expect(sp.has('gender')).toBe(false);
    patchSearchParam(sp, 'tab', 'fans');
    expect(sp.get('tab')).toBe('fans');
  });
});
