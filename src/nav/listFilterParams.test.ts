import { describe, expect, it } from 'vitest';
import {
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
});

describe('parseAvailableRoleParam', () => {
  it('accepts crew role filters', () => {
    expect(parseAvailableRoleParam('mo')).toBe('mo');
    expect(parseAvailableRoleParam('ar')).toBe('ar');
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
    expect(pathWithSearch('/global/schedule/upcoming', params)).toBe(
      '/global/schedule/upcoming?gender=men&date=2026-09-04',
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
