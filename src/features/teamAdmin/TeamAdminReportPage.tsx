import { useMemo } from 'react';
import { EmptyState, EmptyStateBody, Title } from '@patternfly/react-core';
import { useApp, useAppHref } from '@/app/AppContext';
import {
  COACH_FEEDBACK_SCALE_LABELS,
  existingCoachFeedback,
  isMatchEligibleForCoachFeedback,
  matchOfficialForFeedback,
  reportingTeamIdForUser,
} from '@/domain/coachFeedback';
import { matchesForUser } from '@/domain/visibility';
import { MatchListRow } from '@/ui/MatchListRow';

export function TeamAdminReportPage() {
  const { currentUser, state } = useApp();
  const reportBase = useAppHref('/team-admin/report');

  const rows = useMemo(() => {
    if (!currentUser) return [];
    const visible = matchesForUser(state.matches, currentUser, 'teamAdmin');
    return visible
      .filter((m) => isMatchEligibleForCoachFeedback(m, currentUser))
      .map((match) => {
        const reportingTeamId = reportingTeamIdForUser(match, currentUser)!;
        const existing = existingCoachFeedback(
          state.coachFeedback,
          match.id,
          reportingTeamId,
        );
        const mo = matchOfficialForFeedback(match);
        return { match, reportingTeamId, existing, mo };
      })
      .sort(
        (a, b) =>
          new Date(b.match.kickoffAt).getTime() -
          new Date(a.match.kickoffAt).getTime(),
      );
  }, [currentUser, state.matches, state.coachFeedback]);

  if (!currentUser) return null;

  if (!currentUser.roles.includes('teamAdmin')) {
    return (
      <div className="rs-stack">
        <p className="rs-match-card__meta">Team Admin access required.</p>
      </div>
    );
  }

  return (
    <div className="rs-stack">
      <Title headingLevel="h1" size="lg">
        Referee feedback
      </Title>
      <p className="rs-match-card__meta">
        Optional reports on the Match Official after a game. Only the Scheduler
        reviews these — referees do not see them. Leaving feedback helps the
        society spot trends and coaching needs.
      </p>

      {rows.length === 0 ? (
        <EmptyState titleText="No games to report yet" headingLevel="h3">
          <EmptyStateBody>
            After a past match with a confirmed Match Official, it will show up
            here for optional feedback.
          </EmptyStateBody>
        </EmptyState>
      ) : (
        <div className="rs-stack">
          {rows.map(({ match, existing, mo }) => (
            <MatchListRow
              key={match.id}
              match={match}
              to={`${reportBase}/${match.id}`}
              warn={!existing}
              meta={
                mo ? (
                  <span className="rs-match-card__meta">MO {mo.userName}</span>
                ) : null
              }
              trailing={
                <span
                  className={`rs-pill${existing ? '' : ' rs-pill--warn'}`}
                >
                  {existing
                    ? `Submitted · ${COACH_FEEDBACK_SCALE_LABELS[existing.scales.overall]}`
                    : 'Leave feedback'}
                </span>
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
