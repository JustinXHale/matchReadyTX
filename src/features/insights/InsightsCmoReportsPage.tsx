import { useMemo, useState } from 'react';
import {
  EmptyState,
  EmptyStateBody,
  FormGroup,
  FormSelect,
  FormSelectOption,
  TextInput,
  Title,
} from '@patternfly/react-core';
import { useApp, useAppHref } from '@/app/AppContext';
import { submittedCmoReports, cmoReportStats } from '@/domain/insights';
import { displayMatchForCmoReport, type MatchReport } from '@/domain/reports';
import { crewPeople, type Match } from '@/domain/types';
import {
  cmoFilerName,
  cmoFilterOptionsFromOfficialIds,
  cmoSubjectName,
  reportMatchesCmoFilter,
} from '@/features/insights/insightsDisplay';
import { formatInsightsAvg } from '@/features/insights/insightsFormat';
import { InsightsReportTrailing } from '@/features/insights/InsightsReportTrailing';
import { moDisplayNames } from '@/features/referee/appointments/crewLines';
import { cmoReportViewPath } from '@/features/referee/reports/reportLinks';
import { MatchListRow } from '@/ui/MatchListRow';

const ALL_CMOS = '';

export function InsightsCmoReportsPage() {
  const { state } = useApp();
  const memberBase = useAppHref('/about/members');
  const [query, setQuery] = useState('');
  const [cmoFilter, setCmoFilter] = useState(ALL_CMOS);

  const cmoOptions = useMemo(
    () =>
      cmoFilterOptionsFromOfficialIds(
        submittedCmoReports(state.matchReports).map((r) => r.officialId),
        state.matchReports,
        state.users,
      ),
    [state.matchReports, state.users],
  );

  const stats = cmoReportStats(state.matchReports);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return submittedCmoReports(state.matchReports)
      .filter((r) => reportMatchesCmoFilter(r, cmoFilter))
      .map((r) => ({
        report: r,
        match: displayMatchForCmoReport(r, state.matches),
      }))
      .filter(
        (row): row is { report: MatchReport; match: Match } => row.match != null,
      )
      .filter(({ report, match }) => {
        if (!q) return true;
        const subject = cmoSubjectName(
          report,
          match,
          state.users,
          moDisplayNames(match),
        );
        const filer = cmoFilerName(report, state.users);
        const haystack = [
          subject,
          filer,
          match.homeTeamName,
          match.awayTeamName,
          report.legacyFixture?.teamsText,
          report.legacyFixture?.matchLevel,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(q);
      })
      .sort(
        (a, b) =>
          new Date(b.report.kickoffAt).getTime() -
          new Date(a.report.kickoffAt).getTime(),
      );
  }, [state.matchReports, state.matches, state.users, query, cmoFilter]);

  const filteredAvg = useMemo(() => {
    const ratings = rows
      .map(({ report }) => report.cmoPayload?.assessedRating)
      .filter((n): n is number => typeof n === 'number');
    return ratings.length
      ? ratings.reduce((s, v) => s + v, 0) / ratings.length
      : null;
  }, [rows]);

  return (
    <div className="rs-stack">
      <Title headingLevel="h1" size="lg">
        CMO coaching reports
      </Title>
      <p className="rs-match-card__meta">
        {rows.length} of {stats.submittedCount} report
        {stats.submittedCount === 1 ? '' : 's'}
        {filteredAvg != null
          ? ` · avg assessed ${formatInsightsAvg(filteredAvg)}`
          : stats.globalAverage != null
            ? ` · society avg ${formatInsightsAvg(stats.globalAverage)}`
            : ''}
      </p>

      <TextInput
        id="insights-cmo-search"
        type="search"
        value={query}
        onChange={(_e, value) => setQuery(value)}
        placeholder="Search match official reviewed"
        aria-label="Search CMO reports by match official"
      />

      {cmoOptions.length > 0 && (
        <FormGroup label="Filter by CMO" fieldId="insights-cmo-filter">
          <FormSelect
            id="insights-cmo-filter"
            aria-label="Filter by CMO"
            value={cmoFilter}
            onChange={(_event, value) => setCmoFilter(value)}
          >
            <FormSelectOption value="" label="All CMOs" />
            {cmoOptions.map((opt) => (
              <FormSelectOption
                key={opt.value}
                value={opt.value}
                label={opt.name}
              />
            ))}
          </FormSelect>
        </FormGroup>
      )}

      {rows.length === 0 ? (
        <EmptyState titleText="No matching CMO reports" headingLevel="h3">
          <EmptyStateBody>
            {query.trim() || cmoFilter
              ? 'Try a different search or filter.'
              : 'When CMOs submit coaching reports after matches, they will appear here.'}
          </EmptyStateBody>
        </EmptyState>
      ) : (
        <div className="rs-stack">
          {rows.map(({ report: r, match }) => {
            const rating = r.cmoPayload?.assessedRating;
            const subject = cmoSubjectName(
              r,
              match,
              state.users,
              moDisplayNames(match),
            );
            const subjectId =
              r.subjectOfficialId ??
              crewPeople(match.crew.mo).find((a) => a.userId)?.userId;
            const filer = cmoFilerName(r, state.users);
            const viewHref = cmoReportViewPath(r.matchId);
            const trailing = (
              <InsightsReportTrailing
                score={rating != null ? String(rating) : '—'}
                officialName={subject}
                officialHref={
                  subjectId ? `${memberBase}/${subjectId}` : undefined
                }
              />
            );
            return (
              <MatchListRow
                key={r.id}
                match={match}
                to={viewHref}
                split="action"
                meta={
                  <span className="rs-match-card__meta">
                    CMO {filer}
                  </span>
                }
                trailing={trailing}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
