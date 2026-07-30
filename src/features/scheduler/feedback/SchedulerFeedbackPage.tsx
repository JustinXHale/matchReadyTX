import { useMemo } from 'react';
import { EmptyState, EmptyStateBody, Title } from '@patternfly/react-core';
import { Link } from 'react-router-dom';
import { useApp, useAppHref } from '@/app/AppContext';
import { COACH_FEEDBACK_SCALE_LABELS } from '@/domain/coachFeedback';
import { MatchListRow } from '@/ui/MatchListRow';

export function SchedulerFeedbackPage() {
  const { state, hasAssignerRole } = useApp();
  const detailBase = useAppHref('/scheduler/feedback');

  const rows = useMemo(() => {
    return [...state.coachFeedback]
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
      .map((f) => ({
        feedback: f,
        match: state.matches.find((m) => m.id === f.matchId),
      }));
  }, [state.coachFeedback, state.matches]);

  if (!hasAssignerRole) {
    return (
      <p className="rs-match-card__meta">
        Scheduler tools require an assigner role.
      </p>
    );
  }

  return (
    <div className="rs-stack">
      <Title headingLevel="h1" size="lg">
        Coach feedback
      </Title>
      <p className="rs-match-card__meta">
        Confidential Team Admin reports on Match Officials. Officials cannot
        see these. Use them later for ratings and trends.
      </p>

      {rows.length === 0 ? (
        <EmptyState titleText="No coach feedback yet" headingLevel="h3">
          <EmptyStateBody>
            When Team Admins submit referee feedback after a match, it will
            appear here.
          </EmptyStateBody>
        </EmptyState>
      ) : (
        <div className="rs-stack">
          {rows.map(({ feedback: f, match }) => {
            const submitted = new Date(f.createdAt).toLocaleDateString(
              undefined,
              { month: 'short', day: 'numeric' },
            );
            const trailing = (
              <span className="rs-pill">
                {COACH_FEEDBACK_SCALE_LABELS[f.scales.overall]}
              </span>
            );
            const meta = (
              <span className="rs-match-card__meta">
                MO {f.officialName} · {f.reportingTeamName} ({f.submitterName})
                · {submitted}
              </span>
            );
            if (match) {
              return (
                <MatchListRow
                  key={f.id}
                  match={match}
                  to={`${detailBase}/${f.id}`}
                  meta={meta}
                  trailing={trailing}
                />
              );
            }
            return (
              <div key={f.id} className="rs-detail-card">
                <Link
                  to={`${detailBase}/${f.id}`}
                  className="rs-match-card__link"
                >
                  <div className="rs-match-card__main">
                    <span className="rs-match-card__title">
                      {f.homeTeamName} vs {f.awayTeamName}
                    </span>
                    {meta}
                  </div>
                  {trailing}
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
