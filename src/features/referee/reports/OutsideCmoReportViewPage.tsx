import { Link, Navigate, useParams } from 'react-router-dom';
import { Button, Title } from '@patternfly/react-core';
import { useApp } from '@/app/AppContext';
import {
  isOutsideCmoUnlockedForReferee,
  outsideCmoReport,
  outsideMatchId,
  outsidePerformanceReport,
} from '@/domain/outsideCoaching';
import {
  COACHING_MINE_BACK,
  cmoReportViewPath,
  outsideCmoPath,
  outsidePerformancePath,
} from '@/features/referee/reports/reportLinks';
import { useAppBack } from '@/nav/backNav';

/** Gate: referee must submit Performance before viewing the CMO report. */
export function OutsideCmoReportViewPage() {
  const { sessionId = '' } = useParams();
  const { currentUser, state } = useApp();
  const { goBack, backLabel } = useAppBack(COACHING_MINE_BACK);

  const session = state.outsideCoachingSessions.find((s) => s.id === sessionId);
  const cmo = outsideCmoReport(state.matchReports, sessionId);
  const perf = outsidePerformanceReport(state.matchReports, sessionId);

  if (!currentUser) return null;

  if (!session) {
    return (
      <div className="rs-stack">
        <Title headingLevel="h2" size="lg">
          Outside report not found
        </Title>
        <Button variant="secondary" onClick={goBack}>
          ← {backLabel}
        </Button>
      </div>
    );
  }

  const isReferee = session.refereeId === currentUser.uid;
  const isCoach = session.coachId === currentUser.uid;
  const unlocked = isOutsideCmoUnlockedForReferee(sessionId, state.matchReports);

  if (isReferee && !unlocked) {
    return (
      <div className="rs-stack">
        <button type="button" className="rs-detail__back" onClick={goBack}>
          ← {backLabel}
        </button>
        <Title headingLevel="h2" size="lg">
          Coaching report pending
        </Title>
        <p className="rs-match-card__meta">
          {session.homeTeamName} vs {session.awayTeamName} · {session.matchDate}
        </p>
        <p className="rs-match-card__meta">
          {cmo?.status === 'submitted'
            ? 'Your coaching report is ready. Finish your performance self-review to unlock it.'
            : 'Complete your performance report. Your coach may still be filing their side.'}
        </p>
        {perf?.status !== 'submitted' && (
          <Button
            variant="primary"
            component={(props) => (
              <Link {...props} to={outsidePerformancePath(sessionId)} />
            )}
          >
            {perf ? 'Finish performance report' : 'Start performance report'}
          </Button>
        )}
      </div>
    );
  }

  if (!cmo || cmo.status !== 'submitted') {
    if (isCoach) {
      return <Navigate to={outsideCmoPath(session.id)} replace />;
    }
    return (
      <div className="rs-stack">
        <button type="button" className="rs-detail__back" onClick={goBack}>
          ← {backLabel}
        </button>
        <Title headingLevel="h2" size="lg">
          Coaching report not submitted yet
        </Title>
        <p className="rs-match-card__meta">
          {session.homeTeamName} vs {session.awayTeamName}
        </p>
      </div>
    );
  }

  return (
    <Navigate
      to={cmoReportViewPath(outsideMatchId(session.id), session.refereeId, {
        officialId: session.coachId,
      })}
      replace
    />
  );
}
