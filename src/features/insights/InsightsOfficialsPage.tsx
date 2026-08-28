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
import { Link, useSearchParams } from 'react-router-dom';
import { useApp, useAppHref } from '@/app/AppContext';
import {
  GRADE_TIER_ORDER,
  officialInsightRows,
} from '@/domain/insights';
import { formatInsightsAvg } from '@/features/insights/insightsFormat';
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

function officialsBackHref(
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

export function InsightsOfficialsPage() {
  const { state } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const officialsHref = useAppHref('/insights/officials');
  const memberBase = useAppHref('/about/members');

  const gradeFromUrl = searchParams.get('grade') ?? '';
  const noCmoFromUrl = searchParams.get('noCmo') === '1';
  const hasCmoFromUrl = searchParams.get('hasCmo') === '1';
  const cmoFromUrl = searchParams.get('cmo') ?? '';
  const [query, setQuery] = useState('');
  const [gradeFilter, setGradeFilter] = useState(
    gradeFromUrl && TIER_LABELS[Number(gradeFromUrl)]
      ? gradeFromUrl
      : ALL_GRADES,
  );
  const [noCmoOnly, setNoCmoOnly] = useState(noCmoFromUrl && !hasCmoFromUrl);
  const [hasCmoOnly, setHasCmoOnly] = useState(hasCmoFromUrl && !noCmoFromUrl);
  const [cmoFiler, setCmoFiler] = useState(cmoFromUrl);

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
    return [...ids]
      .map((id) => {
        const u = state.users.find((user) => user.uid === id);
        const name = u
          ? u.displayName || `${u.firstName} ${u.lastName}`.trim()
          : id;
        return { id, name };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allRows, state.users]);

  const rows = useMemo(() => {
    return allRows.filter((row) => {
      if (noCmoOnly && row.cmoReportCount > 0) return false;
      if (hasCmoOnly && row.cmoReportCount === 0) return false;
      if (cmoFiler && !noCmoOnly && !row.cmoFilerIds.includes(cmoFiler)) {
        return false;
      }
      return true;
    });
  }, [allRows, noCmoOnly, hasCmoOnly, cmoFiler]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const tier =
      gradeFilter && gradeFilter !== ALL_GRADES ? Number(gradeFilter) : null;
    return rows
      .filter((row) => {
        if (tier != null && Number.isFinite(tier)) {
          return officialTier(row.assessedLevel, row.refereeLevel) === tier;
        }
        return true;
      })
      .filter((row) => !q || row.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [rows, query, gradeFilter]);

  const syncSearchParams = (
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

  const onGradeChange = (
    _event: FormEvent<HTMLSelectElement>,
    value: string,
  ) => {
    setGradeFilter(value);
    syncSearchParams(value, noCmoOnly, hasCmoOnly, cmoFiler);
  };

  const onCmoFilerChange = (
    _event: FormEvent<HTMLSelectElement>,
    value: string,
  ) => {
    setCmoFiler(value);
    const nextNoCmo = false;
    setNoCmoOnly(nextNoCmo);
    syncSearchParams(gradeFilter, nextNoCmo, hasCmoOnly, value);
  };

  const onNoCmoToggle = () => {
    const next = !noCmoOnly;
    setNoCmoOnly(next);
    const nextHasCmo = next ? false : hasCmoOnly;
    setHasCmoOnly(nextHasCmo);
    const nextFiler = next ? ALL_CMOS : cmoFiler;
    if (next) setCmoFiler(ALL_CMOS);
    syncSearchParams(gradeFilter, next, nextHasCmo, nextFiler);
  };

  const onHasCmoToggle = () => {
    const next = !hasCmoOnly;
    setHasCmoOnly(next);
    const nextNoCmo = next ? false : noCmoOnly;
    setNoCmoOnly(nextNoCmo);
    syncSearchParams(gradeFilter, nextNoCmo, next, cmoFiler);
  };

  const backHref = officialsBackHref(
    officialsHref,
    gradeFilter,
    noCmoOnly,
    hasCmoOnly,
    cmoFiler,
  );

  const summaryMeta = noCmoOnly
    ? `${filtered.length} registered official${filtered.length === 1 ? '' : 's'} without a CMO coaching report`
    : hasCmoOnly
      ? `${filtered.length} registered official${filtered.length === 1 ? '' : 's'} with a CMO coaching report`
      : cmoFiler
        ? `${filtered.length} registered official${filtered.length === 1 ? '' : 's'} reviewed by that CMO`
        : `${filtered.length} registered official${filtered.length === 1 ? '' : 's'}`;

  const emptyHint = (() => {
    const extra = Boolean(query.trim() || gradeFilter);
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
        {!noCmoOnly && !hasCmoOnly && !cmoFiler && rows.length !== filtered.length
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
                key={filer.id}
                value={filer.id}
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
      </div>

      {filtered.length === 0 ? (
        <EmptyState titleText="No matching officials" headingLevel="h3">
          <EmptyStateBody>{emptyHint}</EmptyStateBody>
        </EmptyState>
      ) : (
        <div className="rs-stack rs-insights-official-list">
          {filtered.map((row) => {
            const user = state.users.find((u) => u.uid === row.userId);
            if (!user) return null;
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
            const profileHref = `${memberBase}/${row.userId}`;
            const navState = backState({
              to: backHref,
              label: 'Officials',
            });
            return (
              <div key={row.userId} className="rs-insights-official-row">
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
