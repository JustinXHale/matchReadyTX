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
): string {
  const params = new URLSearchParams();
  if (gradeFilter) params.set('grade', gradeFilter);
  if (noCmoOnly) params.set('noCmo', '1');
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
  const [query, setQuery] = useState('');
  const [gradeFilter, setGradeFilter] = useState(
    gradeFromUrl && TIER_LABELS[Number(gradeFromUrl)]
      ? gradeFromUrl
      : ALL_GRADES,
  );
  const [noCmoOnly, setNoCmoOnly] = useState(noCmoFromUrl);

  useEffect(() => {
    const g = searchParams.get('grade') ?? '';
    if (g && TIER_LABELS[Number(g)]) {
      setGradeFilter(g);
    } else if (!g) {
      setGradeFilter(ALL_GRADES);
    }
    setNoCmoOnly(searchParams.get('noCmo') === '1');
  }, [searchParams]);

  const allRows = useMemo(() => {
    return officialInsightRows(
      state.users,
      state.coachFeedback,
      state.matchReports,
      state.matches,
    );
  }, [state.users, state.coachFeedback, state.matchReports, state.matches]);

  const rows = useMemo(() => {
    if (noCmoOnly) {
      return allRows.filter((row) => row.cmoReportCount === 0);
    }
    return allRows;
  }, [allRows, noCmoOnly]);

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

  const syncSearchParams = (grade: string, noCmo: boolean) => {
    const params = new URLSearchParams();
    if (grade) params.set('grade', grade);
    if (noCmo) params.set('noCmo', '1');
    setSearchParams(params);
  };

  const onGradeChange = (
    _event: FormEvent<HTMLSelectElement>,
    value: string,
  ) => {
    setGradeFilter(value);
    syncSearchParams(value, noCmoOnly);
  };

  const onNoCmoToggle = () => {
    const next = !noCmoOnly;
    setNoCmoOnly(next);
    syncSearchParams(gradeFilter, next);
  };

  const backHref = officialsBackHref(officialsHref, gradeFilter, noCmoOnly);

  const summaryMeta = noCmoOnly
    ? `${filtered.length} registered official${filtered.length === 1 ? '' : 's'} without a CMO coaching report`
    : `${filtered.length} registered official${filtered.length === 1 ? '' : 's'}`;

  return (
    <div className="rs-stack">
      <Title headingLevel="h1" size="lg">
        Officials
      </Title>
      <p className="rs-match-card__meta">
        {summaryMeta}
        {!noCmoOnly && rows.length !== filtered.length
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
      </div>

      {filtered.length === 0 ? (
        <EmptyState titleText="No matching officials" headingLevel="h3">
          <EmptyStateBody>
            {noCmoOnly
              ? query.trim() || gradeFilter
                ? 'Try a different search or grade filter.'
                : 'Every official in the society has at least one CMO coaching report on file.'
              : query.trim() || gradeFilter
                ? 'Try a different search or grade filter.'
                : 'Registered referees appear here with coach and CMO report summaries.'}
          </EmptyStateBody>
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
            return (
              <Link
                key={row.userId}
                to={`${memberBase}/${row.userId}`}
                state={backState({
                  to: backHref,
                  label: 'Officials',
                })}
                className="rs-insights-official-row"
              >
                <UserAvatar user={user} size="md" />
                <div className="rs-insights-official-row__identity">
                  <p className="rs-insights-official-row__name">{row.name}</p>
                  <p className="rs-insights-official-row__grade">
                    {gradeLabel(row.assessedLevel, row.refereeLevel)}
                  </p>
                </div>
                <div className="rs-insights-official-row__metric">
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
                </div>
                <div className="rs-insights-official-row__metric">
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
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
