import { useMemo, useState, useEffect, type FormEvent } from 'react';
import {
  EmptyState,
  EmptyStateBody,
  FormGroup,
  FormSelect,
  FormSelectOption,
  TextInput,
  Title,
} from '@patternfly/react-core';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { useApp, useAppHref } from '@/app/AppContext';
import {
  GRADE_TIER_ORDER,
  officialInsightRows,
  type OfficialInsightRow,
} from '@/domain/insights';
import { formatInsightsAvg } from '@/features/insights/insightsFormat';
import {
  cmoFilterOptionsFromOfficialIds,
  rowMatchesCmoFilter,
} from '@/features/insights/insightsDisplay';
import { backState } from '@/nav/backNav';
import { UserAvatar } from '@/ui/UserAvatar';

const TIER_LABELS: Record<number, string> = {
  10: 'Level 10 (C4)',
  9: 'Level 9',
  8: 'Level 8',
  7: 'Level 7',
  6: 'Level 6 (C1+)',
  0: 'Ungraded / unknown',
};

const ALL_GRADES = '';
const ALL_CMOS = '';

function gradeLabel(
  assessedLevel?: number,
  refereeLevel?: number,
): string {
  if (assessedLevel != null) return `Assessed ${assessedLevel}`;
  if (refereeLevel != null) return `Self-assessed ${refereeLevel}`;
  return 'Grade unknown';
}

function officialTier(
  assessedLevel?: number,
  refereeLevel?: number,
): number {
  const grade = assessedLevel ?? refereeLevel ?? null;
  if (grade == null) return 0;
  if (grade >= 10) return 10;
  if (grade <= 6) return 6;
  return grade;
}

type MetricDisplay = {
  label: string;
  avg: string;
  count: string | null;
};

function metricCell(
  label: string,
  count: number,
  avg: number | null,
): MetricDisplay {
  if (count <= 0) {
    return { label, avg: '—', count: null };
  }
  const avgText = avg != null ? formatInsightsAvg(avg) : '—';
  return { label, avg: avgText, count: `(${count})` };
}

function isOfficialsActivityPath(pathname: string): boolean {
  return pathname.endsWith('/officials/activity');
}

type ActivitySortKey = 'name' | 'mo' | 'ar' | 'cmo' | 'total';
type SortDir = 'asc' | 'desc';

const ACTIVITY_SORT_KEYS: ActivitySortKey[] = [
  'name',
  'mo',
  'ar',
  'cmo',
  'total',
];

function parseActivitySortKey(raw: string | null): ActivitySortKey {
  return ACTIVITY_SORT_KEYS.includes(raw as ActivitySortKey)
    ? (raw as ActivitySortKey)
    : 'name';
}

function defaultDirForSort(key: ActivitySortKey): SortDir {
  return key === 'name' ? 'asc' : 'desc';
}

function parseSortDir(raw: string | null, key: ActivitySortKey): SortDir {
  if (raw === 'asc' || raw === 'desc') return raw;
  return defaultDirForSort(key);
}

function compareActivityRows(
  a: OfficialInsightRow,
  b: OfficialInsightRow,
  key: ActivitySortKey,
  dir: SortDir,
): number {
  let cmp = 0;
  if (key === 'name') cmp = a.name.localeCompare(b.name);
  else if (key === 'mo') cmp = a.gamesMo - b.gamesMo;
  else if (key === 'ar') cmp = a.gamesAr - b.gamesAr;
  else if (key === 'cmo') cmp = a.cmoReportsFiled - b.cmoReportsFiled;
  else cmp = a.activityTotal - b.activityTotal;
  if (cmp === 0 && key !== 'name') cmp = a.name.localeCompare(b.name);
  return dir === 'desc' ? -cmp : cmp;
}

function sortIndicator(dir: SortDir): string {
  return dir === 'asc' ? '↑' : '↓';
}

function ActivitySortHeader({
  label,
  column,
  sortKey,
  sortDir,
  onSort,
  identity = false,
}: {
  label: string;
  column: ActivitySortKey;
  sortKey: ActivitySortKey;
  sortDir: SortDir;
  onSort: (key: ActivitySortKey) => void;
  identity?: boolean;
}) {
  const active = sortKey === column;
  const direction = active
    ? sortDir === 'asc'
      ? 'sorted ascending'
      : 'sorted descending'
    : 'not sorted';
  return (
    <button
      type="button"
      className={
        identity
          ? 'rs-insights-official-row__sort rs-insights-official-row__sort--identity'
          : 'rs-insights-official-row__sort'
      }
      aria-label={`${label}, ${direction}`}
      onClick={() => onSort(column)}
    >
      <span>{label}</span>
      {active ? (
        <span className="rs-insights-official-row__sort-dir" aria-hidden="true">
          {sortIndicator(sortDir)}
        </span>
      ) : null}
    </button>
  );
}

function officialsRatingsBackHref(
  officialsHref: string,
  gradeFilter: string,
  noCmoOnly: boolean,
  hasCmoOnly: boolean,
  cmoFiler: string,
): string {
  const params = new URLSearchParams();
  if (gradeFilter) params.set('grade', gradeFilter);
  if (noCmoOnly) params.set('noCmo', '1');
  if (hasCmoOnly) params.set('hasCmo', '1');
  if (cmoFiler && !noCmoOnly) params.set('cmo', cmoFiler);
  const q = params.toString();
  return q ? `${officialsHref}?${q}` : officialsHref;
}

function officialsActivityBackHref(
  officialsHref: string,
  gradeFilter: string,
  noMoOnly: boolean,
  noArOnly: boolean,
  sortKey: ActivitySortKey,
  sortDir: SortDir,
): string {
  const params = new URLSearchParams();
  if (gradeFilter) params.set('grade', gradeFilter);
  if (noMoOnly) params.set('noMo', '1');
  if (noArOnly) params.set('noAr', '1');
  if (sortKey !== 'name') params.set('sort', sortKey);
  if (sortDir !== defaultDirForSort(sortKey)) params.set('dir', sortDir);
  const q = params.toString();
  return q ? `${officialsHref}?${q}` : officialsHref;
}

export function InsightsOfficialsPage() {
  const { state } = useApp();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const isActivity = isOfficialsActivityPath(location.pathname);
  const ratingsHref = useAppHref('/insights/officials');
  const activityHref = useAppHref('/insights/officials/activity');
  const officialsHref = isActivity ? activityHref : ratingsHref;
  const memberBase = useAppHref('/about/members');

  const gradeFromUrl = searchParams.get('grade') ?? '';
  const noCmoFromUrl = searchParams.get('noCmo') === '1';
  const hasCmoFromUrl = searchParams.get('hasCmo') === '1';
  const cmoFromUrl = searchParams.get('cmo') ?? '';
  const noMoFromUrl = searchParams.get('noMo') === '1';
  const noArFromUrl = searchParams.get('noAr') === '1';
  const sortFromUrl = parseActivitySortKey(searchParams.get('sort'));
  const dirFromUrl = parseSortDir(searchParams.get('dir'), sortFromUrl);
  const [query, setQuery] = useState('');
  const [gradeFilter, setGradeFilter] = useState(
    gradeFromUrl && TIER_LABELS[Number(gradeFromUrl)]
      ? gradeFromUrl
      : ALL_GRADES,
  );
  const [noCmoOnly, setNoCmoOnly] = useState(noCmoFromUrl && !hasCmoFromUrl);
  const [hasCmoOnly, setHasCmoOnly] = useState(hasCmoFromUrl && !noCmoFromUrl);
  const [cmoFiler, setCmoFiler] = useState(cmoFromUrl);
  const [noMoOnly, setNoMoOnly] = useState(noMoFromUrl);
  const [noArOnly, setNoArOnly] = useState(noArFromUrl);
  const [sortKey, setSortKey] = useState<ActivitySortKey>(sortFromUrl);
  const [sortDir, setSortDir] = useState<SortDir>(dirFromUrl);

  useEffect(() => {
    const g = searchParams.get('grade') ?? '';
    if (g && TIER_LABELS[Number(g)]) {
      setGradeFilter(g);
    } else if (!g) {
      setGradeFilter(ALL_GRADES);
    }
    const noCmo = searchParams.get('noCmo') === '1';
    const hasCmo = searchParams.get('hasCmo') === '1';
    setNoCmoOnly(noCmo && !hasCmo);
    setHasCmoOnly(hasCmo && !noCmo);
    setCmoFiler(searchParams.get('cmo') ?? '');
    setNoMoOnly(searchParams.get('noMo') === '1');
    setNoArOnly(searchParams.get('noAr') === '1');
    const nextSort = parseActivitySortKey(searchParams.get('sort'));
    setSortKey(nextSort);
    setSortDir(parseSortDir(searchParams.get('dir'), nextSort));
  }, [searchParams]);

  const allRows = useMemo(() => {
    return officialInsightRows(
      state.users,
      state.coachFeedback,
      state.matchReports,
      state.matches,
    );
  }, [state.users, state.coachFeedback, state.matchReports, state.matches]);

  const cmoFilers = useMemo(() => {
    const ids = new Set<string>();
    for (const row of allRows) {
      for (const id of row.cmoFilerIds) ids.add(id);
    }
    return cmoFilterOptionsFromOfficialIds(
      ids,
      state.matchReports,
      state.users,
    );
  }, [allRows, state.matchReports, state.users]);

  const rows = useMemo(() => {
    return allRows.filter((row) => {
      if (isActivity) {
        if (noMoOnly && row.gamesMo > 0) return false;
        if (noArOnly && row.gamesAr > 0) return false;
        return true;
      }
      if (noCmoOnly && row.cmoReportCount > 0) return false;
      if (hasCmoOnly && row.cmoReportCount === 0) return false;
      if (cmoFiler && !noCmoOnly && !rowMatchesCmoFilter(row.cmoFilerIds, cmoFiler)) {
        return false;
      }
      return true;
    });
  }, [allRows, isActivity, noMoOnly, noArOnly, noCmoOnly, hasCmoOnly, cmoFiler]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const tier =
      gradeFilter && gradeFilter !== ALL_GRADES ? Number(gradeFilter) : null;
    const matched = rows
      .filter((row) => {
        if (tier != null && Number.isFinite(tier)) {
          return officialTier(row.assessedLevel, row.refereeLevel) === tier;
        }
        return true;
      })
      .filter((row) => !q || row.name.toLowerCase().includes(q));
    if (isActivity) {
      return [...matched].sort((a, b) =>
        compareActivityRows(a, b, sortKey, sortDir),
      );
    }
    return matched.sort((a, b) => a.name.localeCompare(b.name));
  }, [rows, query, gradeFilter, isActivity, sortKey, sortDir]);

  const syncRatingsParams = (
    grade: string,
    noCmo: boolean,
    hasCmo: boolean,
    filer: string,
  ) => {
    const params = new URLSearchParams();
    if (grade) params.set('grade', grade);
    if (noCmo) params.set('noCmo', '1');
    if (hasCmo) params.set('hasCmo', '1');
    if (filer && !noCmo) params.set('cmo', filer);
    setSearchParams(params);
  };

  const syncActivityParams = (
    grade: string,
    noMo: boolean,
    noAr: boolean,
    nextSort: ActivitySortKey,
    nextDir: SortDir,
  ) => {
    const params = new URLSearchParams();
    if (grade) params.set('grade', grade);
    if (noMo) params.set('noMo', '1');
    if (noAr) params.set('noAr', '1');
    if (nextSort !== 'name') params.set('sort', nextSort);
    if (nextDir !== defaultDirForSort(nextSort)) params.set('dir', nextDir);
    setSearchParams(params);
  };

  const onGradeChange = (
    _event: FormEvent<HTMLSelectElement>,
    value: string,
  ) => {
    setGradeFilter(value);
    if (isActivity) {
      syncActivityParams(value, noMoOnly, noArOnly, sortKey, sortDir);
    } else {
      syncRatingsParams(value, noCmoOnly, hasCmoOnly, cmoFiler);
    }
  };

  const onCmoFilerChange = (
    _event: FormEvent<HTMLSelectElement>,
    value: string,
  ) => {
    setCmoFiler(value);
    const nextNoCmo = false;
    setNoCmoOnly(nextNoCmo);
    syncRatingsParams(gradeFilter, nextNoCmo, hasCmoOnly, value);
  };

  const onNoCmoToggle = () => {
    const next = !noCmoOnly;
    setNoCmoOnly(next);
    const nextHasCmo = next ? false : hasCmoOnly;
    setHasCmoOnly(nextHasCmo);
    const nextFiler = next ? ALL_CMOS : cmoFiler;
    if (next) setCmoFiler(ALL_CMOS);
    syncRatingsParams(gradeFilter, next, nextHasCmo, nextFiler);
  };

  const onHasCmoToggle = () => {
    const next = !hasCmoOnly;
    setHasCmoOnly(next);
    const nextNoCmo = next ? false : noCmoOnly;
    setNoCmoOnly(nextNoCmo);
    syncRatingsParams(gradeFilter, nextNoCmo, next, cmoFiler);
  };

  const onNoMoToggle = () => {
    const next = !noMoOnly;
    setNoMoOnly(next);
    syncActivityParams(gradeFilter, next, noArOnly, sortKey, sortDir);
  };

  const onNoArToggle = () => {
    const next = !noArOnly;
    setNoArOnly(next);
    syncActivityParams(gradeFilter, noMoOnly, next, sortKey, sortDir);
  };

  const onActivitySort = (key: ActivitySortKey) => {
    const nextDir =
      sortKey === key
        ? sortDir === 'asc'
          ? 'desc'
          : 'asc'
        : defaultDirForSort(key);
    setSortKey(key);
    setSortDir(nextDir);
    syncActivityParams(gradeFilter, noMoOnly, noArOnly, key, nextDir);
  };

  const backHref = isActivity
    ? officialsActivityBackHref(
        officialsHref,
        gradeFilter,
        noMoOnly,
        noArOnly,
        sortKey,
        sortDir,
      )
    : officialsRatingsBackHref(
        officialsHref,
        gradeFilter,
        noCmoOnly,
        hasCmoOnly,
        cmoFiler,
      );

  const summaryMeta = (() => {
    const n = filtered.length;
    const plural = n === 1 ? '' : 's';
    if (isActivity) {
      if (noMoOnly && noArOnly) {
        return `${n} registered official${plural} with no center and no AR match`;
      }
      if (noMoOnly) {
        return `${n} registered official${plural} with no center match`;
      }
      if (noArOnly) {
        return `${n} registered official${plural} with no AR match`;
      }
      return `${n} registered official${plural}`;
    }
    if (noCmoOnly) {
      return `${n} registered official${plural} without a CMO coaching report`;
    }
    if (hasCmoOnly) {
      return `${n} registered official${plural} with a CMO coaching report`;
    }
    if (cmoFiler) {
      return `${n} registered official${plural} reviewed by that CMO`;
    }
    return `${n} registered official${plural}`;
  })();

  const extraFiltersActive = isActivity
    ? Boolean(query.trim() || gradeFilter || noMoOnly || noArOnly)
    : Boolean(query.trim() || gradeFilter);
  const showFilteredCount = isActivity
    ? extraFiltersActive && rows.length !== filtered.length
    : !noCmoOnly &&
      !hasCmoOnly &&
      !cmoFiler &&
      rows.length !== filtered.length;

  const emptyHint = (() => {
    const extra = Boolean(query.trim() || gradeFilter);
    if (isActivity) {
      if (noMoOnly && noArOnly) {
        return extra
          ? 'Try a different search or grade filter.'
          : 'Every official has a center or AR assignment on file.';
      }
      if (noMoOnly) {
        return extra
          ? 'Try a different search or grade filter.'
          : 'Every official has a center match on file.';
      }
      if (noArOnly) {
        return extra
          ? 'Try a different search or grade filter.'
          : 'Every official has an AR match on file.';
      }
      return extra
        ? 'Try a different search or grade filter.'
        : 'Registered referees appear here with match and CMO report counts.';
    }
    if (noCmoOnly) {
      return extra
        ? 'Try a different search or grade filter.'
        : 'Every official in the society has at least one CMO coaching report on file.';
    }
    if (cmoFiler) {
      return extra
        ? 'Try a different search or grade filter.'
        : 'No officials have a submitted CMO report from that filer.';
    }
    if (hasCmoOnly) {
      return extra
        ? 'Try a different search or grade filter.'
        : 'No officials have a submitted CMO coaching report yet.';
    }
    return extra
      ? 'Try a different search or grade filter.'
      : 'Registered referees appear here with coach and CMO report summaries.';
  })();

  return (
    <div className="rs-stack">
      <Title headingLevel="h1" size="lg">
        Officials
      </Title>
      <p className="rs-match-card__meta">
        {summaryMeta}
        {showFilteredCount
          ? ` · showing ${filtered.length} of ${rows.length}`
          : ''}
      </p>

      <TextInput
        id="insights-officials-search"
        type="search"
        value={query}
        onChange={(_e, value) => setQuery(value)}
        placeholder="Search official name"
        aria-label="Search officials"
      />

      <div className="rs-insights-official-filters">
        <FormGroup
          label="Filter by grade"
          fieldId="insights-officials-grade"
          className="rs-insights-official-filters__grade"
        >
          <FormSelect
            id="insights-officials-grade"
            aria-label="Filter by grade"
            value={gradeFilter}
            onChange={onGradeChange}
          >
            <FormSelectOption value="" label="All grades" />
            {GRADE_TIER_ORDER.map((level) => (
              <FormSelectOption
                key={level}
                value={String(level)}
                label={TIER_LABELS[level] ?? `Level ${level}`}
              />
            ))}
          </FormSelect>
        </FormGroup>
        {isActivity ? (
          <div className="rs-insights-official-filters__chips">
            <button
              type="button"
              className={`rs-filter-chip rs-insights-official-filters__toggle${
                noMoOnly ? ' rs-filter-chip--selected' : ''
              }`}
              aria-pressed={noMoOnly}
              onClick={onNoMoToggle}
            >
              No MO
            </button>
            <button
              type="button"
              className={`rs-filter-chip rs-insights-official-filters__toggle${
                noArOnly ? ' rs-filter-chip--selected' : ''
              }`}
              aria-pressed={noArOnly}
              onClick={onNoArToggle}
            >
              No AR
            </button>
          </div>
        ) : (
          <>
            <FormGroup
              label="Filter by CMO"
              fieldId="insights-officials-cmo"
              className="rs-insights-official-filters__grade"
            >
              <FormSelect
                id="insights-officials-cmo"
                aria-label="Filter by CMO"
                value={noCmoOnly ? ALL_CMOS : cmoFiler}
                isDisabled={noCmoOnly || cmoFilers.length === 0}
                onChange={onCmoFilerChange}
              >
                <FormSelectOption value="" label="All CMOs" />
                {cmoFilers.map((filer) => (
                  <FormSelectOption
                    key={filer.value}
                    value={filer.value}
                    label={filer.name}
                  />
                ))}
              </FormSelect>
            </FormGroup>
            <div className="rs-insights-official-filters__chips">
              <button
                type="button"
                className={`rs-filter-chip rs-insights-official-filters__toggle${
                  noCmoOnly ? ' rs-filter-chip--selected' : ''
                }`}
                aria-pressed={noCmoOnly}
                onClick={onNoCmoToggle}
              >
                No CMO report
              </button>
              <button
                type="button"
                className={`rs-filter-chip rs-insights-official-filters__toggle${
                  hasCmoOnly ? ' rs-filter-chip--selected' : ''
                }`}
                aria-pressed={hasCmoOnly}
                onClick={onHasCmoToggle}
              >
                Has CMO report
              </button>
            </div>
          </>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState titleText="No matching officials" headingLevel="h3">
          <EmptyStateBody>{emptyHint}</EmptyStateBody>
        </EmptyState>
      ) : (
        <div className="rs-stack rs-insights-official-list">
          {isActivity ? (
            <div className="rs-insights-official-row rs-insights-official-row--activity rs-insights-official-row--head">
              <ActivitySortHeader
                label="Official"
                column="name"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={onActivitySort}
                identity
              />
              <ActivitySortHeader
                label="Matches officiated"
                column="mo"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={onActivitySort}
              />
              <ActivitySortHeader
                label="AR matches"
                column="ar"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={onActivitySort}
              />
              <ActivitySortHeader
                label="CMO reports submitted"
                column="cmo"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={onActivitySort}
              />
              <ActivitySortHeader
                label="Total"
                column="total"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={onActivitySort}
              />
            </div>
          ) : null}
          {filtered.map((row) => {
            const user = state.users.find((u) => u.uid === row.userId);
            if (!user) return null;
            const profileHref = `${memberBase}/${row.userId}`;
            const navState = backState({
              to: backHref,
              label: 'Officials',
            });
            const rowClass = isActivity
              ? 'rs-insights-official-row rs-insights-official-row--activity'
              : 'rs-insights-official-row';
            const identity = (
              <Link
                to={profileHref}
                state={navState}
                className="rs-insights-official-row__identity"
              >
                <UserAvatar user={user} size="md" />
                <div>
                  <p className="rs-insights-official-row__name">{row.name}</p>
                  <p className="rs-insights-official-row__grade">
                    {gradeLabel(row.assessedLevel, row.refereeLevel)}
                  </p>
                </div>
              </Link>
            );
            if (isActivity) {
              const activityMetrics = [
                { key: 'mo', value: String(row.gamesMo) },
                { key: 'ar', value: String(row.gamesAr) },
                { key: 'cmo', value: String(row.cmoReportsFiled) },
                { key: 'total', value: String(row.activityTotal) },
              ];
              return (
                <div key={row.userId} className={rowClass}>
                  {identity}
                  {activityMetrics.map((metric) => (
                    <Link
                      key={metric.key}
                      to={profileHref}
                      state={navState}
                      className="rs-insights-official-row__metric"
                    >
                      <span className="rs-insights-official-row__metric-value">
                        <span>{metric.value}</span>
                      </span>
                    </Link>
                  ))}
                </div>
              );
            }
            const cmo = metricCell(
              'CMO Rating',
              row.cmoReportCount,
              row.cmoRatingAvg,
            );
            const coach = metricCell(
              'Team Feedback',
              row.coachFeedbackCount,
              row.coachFeedbackAvg,
            );
            return (
              <div key={row.userId} className={rowClass}>
                {identity}
                <Link
                  to={`${profileHref}#cmo-reports`}
                  state={navState}
                  className="rs-insights-official-row__metric"
                >
                  <span className="rs-insights-official-row__metric-label">
                    {cmo.label}
                  </span>
                  <span className="rs-insights-official-row__metric-value">
                    <span>{cmo.avg}</span>
                    {cmo.count ? (
                      <span className="rs-insights-official-row__metric-count">
                        {cmo.count}
                      </span>
                    ) : null}
                  </span>
                </Link>
                <Link
                  to={`${profileHref}#team-feedback`}
                  state={navState}
                  className="rs-insights-official-row__metric"
                >
                  <span className="rs-insights-official-row__metric-label">
                    {coach.label}
                  </span>
                  <span className="rs-insights-official-row__metric-value">
                    <span>{coach.avg}</span>
                    {coach.count ? (
                      <span className="rs-insights-official-row__metric-count">
                        {coach.count}
                      </span>
                    ) : null}
                  </span>
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
