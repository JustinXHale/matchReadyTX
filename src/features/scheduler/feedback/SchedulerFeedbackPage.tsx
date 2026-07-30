import { useMemo } from 'react';
import { EmptyState, EmptyStateBody, Title } from '@patternfly/react-core';
import { Link } from 'react-router-dom';
import { useApp, useAppHref } from '@/app/AppContext';
import { coachFeedbackAverage } from '@/domain/coachFeedback';
import { MatchListRow } from '@/ui/MatchListRow';

function formatAvg(avg: number): string {
  return Number.isInteger(avg) ? String(avg) : avg.toFixed(1);
}

export function SchedulerFeedbackPage() {
  const { state, hasAssignerRole } = useApp();
  const detailBase = useAppHref('/scheduler/feedback');
  const memberBase = useAppHref('/members');

  const rows = useMemo(() => {
    return [...state.coachFeedback]
      .filter((f) => f.status === 'submitted')
      .sort(
        (a, b) =>
          new Date(b.updatedAt || b.createdAt).getTime() -
          new Date(a.updatedAt || a.createdAt).getTime(),
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
        see these. Drafts and declines stay with the club until submitted. The
        score on each card is the average of all ratings (1–5).
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
              <div className="rs-coach-feedback-trailing">
                <span className="rs-pill">
                  {avg != null ? formatAvg(avg) : '—'}
                </span>
                {officialHref ? (
                  <Link
                    to={officialHref}
                    className="rs-coach-feedback-trailing__mo"
                    onClick={(e) => e.stopPropagation()}
                  >
                    MO {f.officialName}
                  </Link>
                ) : (
                  <span className="rs-coach-feedback-trailing__mo">
                    MO {f.officialName}
                  </span>
                )}
              </div>
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
