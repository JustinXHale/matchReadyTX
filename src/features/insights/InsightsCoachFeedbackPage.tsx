import { useMemo, useState, type FormEvent } from 'react';
import {
  EmptyState,
  EmptyStateBody,
  FormGroup,
  FormSelect,
  FormSelectOption,
  TextInput,
  Title,
} from '@patternfly/react-core';
import { Link } from 'react-router-dom';
import { useApp, useAppHref } from '@/app/AppContext';
import { coachFeedbackAverage } from '@/domain/coachFeedback';
import { formatInsightsAvg } from '@/features/insights/insightsFormat';
import { InsightsReportTrailing } from '@/features/insights/InsightsReportTrailing';
import { MatchListRow } from '@/ui/MatchListRow';

function formatAvg(avg: number): string {
  return formatInsightsAvg(avg);
}

const ALL_TEAMS = '';

export function InsightsCoachFeedbackPage() {
  const { state } = useApp();
  const detailBase = useAppHref('/insights/reports/coach-feedback');
  const memberBase = useAppHref('/about/members');
  const [query, setQuery] = useState('');
  const [teamFilter, setTeamFilter] = useState(ALL_TEAMS);

  const teamOptions = useMemo(() => {
    const byId = new Map<string, string>();
    for (const f of state.coachFeedback) {
      if (f.status !== 'submitted' || !f.reportingTeamId) continue;
      byId.set(f.reportingTeamId, f.reportingTeamName);
    }
    return [...byId.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [state.coachFeedback]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...state.coachFeedback]
      .filter((f) => f.status === 'submitted')
      .filter((f) => (teamFilter ? f.reportingTeamId === teamFilter : true))
      .filter((f) => {
        if (!q) return true;
        const haystack = [
          f.officialName,
          f.homeTeamName,
          f.awayTeamName,
          f.reportingTeamName,
          f.submitterName,
        ]
          .join(' ')
          .toLowerCase();
        return haystack.includes(q);
      })
      .sort(
        (a, b) =>
          new Date(b.updatedAt || b.createdAt).getTime() -
          new Date(a.updatedAt || a.createdAt).getTime(),
      )
      .map((f) => ({
        feedback: f,
        match: state.matches.find((m) => m.id === f.matchId),
      }));
  }, [state.coachFeedback, state.matches, query, teamFilter]);

  const avgRating = useMemo(() => {
    const avgs = rows
      .map(({ feedback }) => coachFeedbackAverage(feedback.scales))
      .filter((a): a is number => a != null);
    return avgs.length
      ? avgs.reduce((s, v) => s + v, 0) / avgs.length
      : null;
  }, [rows]);

  return (
    <div className="rs-stack">
      <Title headingLevel="h1" size="lg">
        Coach feedback
      </Title>
      <p className="rs-match-card__meta">
        {rows.length} report{rows.length === 1 ? '' : 's'}
        {avgRating != null ? ` · avg ${formatAvg(avgRating)} (1–5)` : ''}
      </p>

      <div className="rs-insights-official-filters">
        <FormGroup
          label="Filter by team"
          fieldId="insights-coach-team"
          className="rs-insights-official-filters__grade"
        >
          <FormSelect
            id="insights-coach-team"
            aria-label="Filter by reporting team"
            value={teamFilter}
            onChange={(_event: FormEvent<HTMLSelectElement>, value: string) =>
              setTeamFilter(value)
            }
          >
            <FormSelectOption value="" label="All teams" />
            {teamOptions.map((team) => (
              <FormSelectOption
                key={team.id}
                value={team.id}
                label={team.name}
              />
            ))}
          </FormSelect>
        </FormGroup>
        <FormGroup
          label="Search"
          fieldId="insights-coach-search"
          className="rs-insights-coach-filters__search"
        >
          <TextInput
            id="insights-coach-search"
            type="search"
            value={query}
            onChange={(_e, value) => setQuery(value)}
            placeholder="Referee, team, or submitter"
            aria-label="Search coach feedback"
          />
        </FormGroup>
      </div>

      {rows.length === 0 ? (
        <EmptyState titleText="No matching feedback" headingLevel="h3">
          <EmptyStateBody>
            {query.trim() || teamFilter
              ? 'Try a different search or team filter.'
              : 'When Team Admins submit referee feedback after a match, it will appear here.'}
          </EmptyStateBody>
        </EmptyState>
      ) : (
        <div className="rs-stack">
          {rows.map(({ feedback: f, match }) => {
            const avg = coachFeedbackAverage(f.scales);
            const detailHref = `${detailBase}/${f.id}`;
            const officialHref = f.officialUserId
              ? `${memberBase}/${f.officialUserId}`
              : null;
            const meta = (
              <span className="rs-match-card__meta">
                {f.reportingTeamName} · {f.submitterName}
                {f.clubRole ? ` · ${f.clubRole}` : ''}
              </span>
            );
            const trailing = (
              <InsightsReportTrailing
                score={avg != null ? formatAvg(avg) : '—'}
                officialName={f.officialName}
                officialHref={officialHref ?? undefined}
              />
            );

            if (match) {
              return (
                <MatchListRow
                  key={f.id}
                  match={match}
                  to={detailHref}
                  split="action"
                  meta={meta}
                  trailing={trailing}
                />
              );
            }
            return (
              <div key={f.id} className="rs-list-row rs-list-row--action">
                <Link to={detailHref} className="rs-list-row__main">
                  <div className="rs-list-row__body">
                    <span className="rs-match-card__title">
                      {f.homeTeamName} vs {f.awayTeamName}
                    </span>
                    {meta}
                  </div>
                </Link>
                <div className="rs-list-row__trailing">{trailing}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
