import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { MemberTab, TeamAdminSort } from '@/domain/members';
import {
  parseCompletedOutcomeParam,
  type CompletedOutcomeFilter,
} from '@/domain/requests';
import type { MatchGender } from '@/domain/types';

export function parseGenderParam(raw: string | null): MatchGender | null {
  if (raw === 'men' || raw === 'women') return raw;
  return null;
}

export function patchSearchParam(
  params: URLSearchParams,
  key: string,
  value: string | null | undefined,
): void {
  if (value == null || value === '') params.delete(key);
  else params.set(key, value);
}

/** Append current query string to a path (for back links that restore filters). */
export function pathWithSearch(path: string, params: URLSearchParams): string {
  const q = params.toString();
  return q ? `${path}?${q}` : path;
}

function usePatchSearchParams() {
  const [searchParams, setSearchParams] = useSearchParams();
  const patch = useCallback(
    (mutate: (sp: URLSearchParams) => void) => {
      setSearchParams(
        (prev) => {
          const sp = new URLSearchParams(prev);
          mutate(sp);
          return sp;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );
  return { searchParams, patch };
}

function useDivisionFilterFields(
  searchParams: URLSearchParams,
  patch: (mutate: (sp: URLSearchParams) => void) => void,
) {
  const genderFilter = parseGenderParam(searchParams.get('gender'));
  const levelFilter = searchParams.get('level') || null;
  const competitionFilter = searchParams.get('competition') || null;
  const dateFilter = searchParams.get('date') || null;

  const setGenderFilter = useCallback(
    (value: MatchGender | null) => {
      patch((sp) => patchSearchParam(sp, 'gender', value));
    },
    [patch],
  );
  const setLevelFilter = useCallback(
    (value: string | null) => {
      patch((sp) => patchSearchParam(sp, 'level', value));
    },
    [patch],
  );
  const setCompetitionFilter = useCallback(
    (value: string | null) => {
      patch((sp) => patchSearchParam(sp, 'competition', value));
    },
    [patch],
  );
  const setDateFilter = useCallback(
    (value: string | null) => {
      patch((sp) => patchSearchParam(sp, 'date', value));
    },
    [patch],
  );

  return {
    genderFilter,
    levelFilter,
    competitionFilter,
    dateFilter,
    setGenderFilter,
    setLevelFilter,
    setCompetitionFilter,
    setDateFilter,
  };
}

export function useDivisionFilterParams() {
  const { searchParams, patch } = usePatchSearchParams();
  return {
    searchParams,
    ...useDivisionFilterFields(searchParams, patch),
  };
}

export type ScheduleSortDir = 'asc' | 'desc';

export function useGlobalScheduleFilterParams() {
  const { searchParams, patch } = usePatchSearchParams();
  const division = useDivisionFilterFields(searchParams, patch);

  const sortDir: ScheduleSortDir =
    searchParams.get('sort') === 'desc' ? 'desc' : 'asc';
  const myTeamsOnly = searchParams.get('myTeams') === '1';

  const setSortDir = useCallback(
    (value: ScheduleSortDir) => {
      patch((sp) =>
        patchSearchParam(sp, 'sort', value === 'asc' ? null : value),
      );
    },
    [patch],
  );
  const setMyTeamsOnly = useCallback(
    (value: boolean) => {
      patch((sp) => patchSearchParam(sp, 'myTeams', value ? '1' : null));
    },
    [patch],
  );

  const completedOutcome = parseCompletedOutcomeParam(
    searchParams.get('outcome'),
  );
  const setCompletedOutcome = useCallback(
    (value: CompletedOutcomeFilter) => {
      patch((sp) =>
        patchSearchParam(sp, 'outcome', value === 'all' ? null : value),
      );
    },
    [patch],
  );

  return {
    searchParams,
    ...division,
    sortDir,
    myTeamsOnly,
    completedOutcome,
    setSortDir,
    setMyTeamsOnly,
    setCompletedOutcome,
  };
}

export type AvailableRoleFilter = 'mo' | 'ar' | 'cmo' | 'no4';

const ROLE_FILTER_VALUES = new Set<AvailableRoleFilter>(['mo', 'ar', 'cmo', 'no4']);

export function parseAvailableRoleParam(
  raw: string | null,
): AvailableRoleFilter | null {
  if (raw && ROLE_FILTER_VALUES.has(raw as AvailableRoleFilter)) {
    return raw as AvailableRoleFilter;
  }
  return null;
}

export function useAvailableMatchesFilterParams() {
  const { searchParams, patch } = usePatchSearchParams();
  const division = useDivisionFilterFields(searchParams, patch);

  const roleFilter = parseAvailableRoleParam(searchParams.get('role'));
  const formatFilter = searchParams.get('format') || null;

  const setRoleFilter = useCallback(
    (value: AvailableRoleFilter | null) => {
      patch((sp) => patchSearchParam(sp, 'role', value));
    },
    [patch],
  );
  const setFormatFilter = useCallback(
    (value: string | null) => {
      patch((sp) => patchSearchParam(sp, 'format', value));
    },
    [patch],
  );

  return {
    searchParams,
    ...division,
    roleFilter,
    formatFilter,
    setRoleFilter,
    setFormatFilter,
  };
}

export type SchedulerStatusFilter =
  | 'all'
  | 'needs_assignment'
  | 'open_slots'
  | 'needs_reassignment'
  | 'draft'
  | 'pending_team_review'
  | 'crew_pending'
  | 'locked_confirmed';

const SCHEDULER_STATUS_VALUES = new Set<string>([
  'all',
  'needs_assignment',
  'open_slots',
  'needs_reassignment',
  'draft',
  'pending_team_review',
  'crew_pending',
  'locked_confirmed',
]);

export function parseSchedulerStatusParam(
  raw: string | null,
  legacyNeeds: string | null,
): SchedulerStatusFilter {
  if (raw && SCHEDULER_STATUS_VALUES.has(raw)) {
    return raw as SchedulerStatusFilter;
  }
  if (legacyNeeds === '1' || legacyNeeds === 'assignment') {
    return 'needs_assignment';
  }
  return 'all';
}

export function useSchedulerScheduleFilterParams() {
  const { searchParams, patch } = usePatchSearchParams();
  const division = useDivisionFilterFields(searchParams, patch);

  const statusFilter = parseSchedulerStatusParam(
    searchParams.get('status'),
    searchParams.get('needs'),
  );

  const setStatusFilter = useCallback(
    (value: SchedulerStatusFilter) => {
      patch((sp) => {
        patchSearchParam(sp, 'status', value === 'all' ? null : value);
        sp.delete('needs');
      });
    },
    [patch],
  );

  return {
    searchParams,
    ...division,
    statusFilter,
    setStatusFilter,
  };
}

const MEMBER_TABS = new Set<MemberTab>([
  'referees',
  'teamAdmins',
  'cmos',
  'fans',
]);

export function parseMemberTabParam(raw: string | null): MemberTab {
  if (raw && MEMBER_TABS.has(raw as MemberTab)) return raw as MemberTab;
  return 'referees';
}

export function useMembersFilterParams() {
  const { searchParams, patch } = usePatchSearchParams();

  const tab = parseMemberTabParam(searchParams.get('tab'));
  const query = searchParams.get('q') ?? '';
  const completeness = ((): 'all' | 'complete' | 'incomplete' => {
    const raw = searchParams.get('complete');
    if (raw === 'complete' || raw === 'incomplete') return raw;
    return 'all';
  })();
  const teamAdminSort: TeamAdminSort =
    searchParams.get('sort') === 'team' ? 'team' : 'contact';
  const genderFilter = parseGenderParam(searchParams.get('gender'));

  const setTab = useCallback(
    (value: MemberTab) => {
      patch((sp) => patchSearchParam(sp, 'tab', value === 'referees' ? null : value));
    },
    [patch],
  );
  const setQuery = useCallback(
    (value: string) => {
      patch((sp) => patchSearchParam(sp, 'q', value.trim() || null));
    },
    [patch],
  );
  const setCompleteness = useCallback(
    (value: 'all' | 'complete' | 'incomplete') => {
      patch((sp) =>
        patchSearchParam(sp, 'complete', value === 'all' ? null : value),
      );
    },
    [patch],
  );
  const setTeamAdminSort = useCallback(
    (value: TeamAdminSort) => {
      patch((sp) =>
        patchSearchParam(sp, 'sort', value === 'contact' ? null : value),
      );
    },
    [patch],
  );
  const setGenderFilter = useCallback(
    (value: MatchGender | null) => {
      patch((sp) => patchSearchParam(sp, 'gender', value));
    },
    [patch],
  );

  return {
    searchParams,
    tab,
    query,
    completeness,
    teamAdminSort,
    genderFilter,
    setTab,
    setQuery,
    setCompleteness,
    setTeamAdminSort,
    setGenderFilter,
  };
}
