import { Navigate, useParams } from 'react-router-dom';
import { Button, Title } from '@patternfly/react-core';
import { useApp } from '@/app/AppContext';
import { outsideMatchId } from '@/domain/outsideCoaching';
import { cmoReportPath } from '@/features/referee/reports/reportLinks';
import { useAppBack } from '@/nav/backNav';
import { COACHING_CMO_BACK } from '@/features/referee/reports/reportLinks';

/** Routes outside coaching to the shared CMO form with a synthetic match id. */
export function OutsideCmoReportPage() {
  const { sessionId = '' } = useParams();
  const { currentUser, state } = useApp();
  const { goBack, backLabel } = useAppBack(COACHING_CMO_BACK);

  const session = state.outsideCoachingSessions.find((s) => s.id === sessionId);

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

  if (session.coachId !== currentUser.uid) {
    return (
      <div className="rs-stack">
        <Title headingLevel="h2" size="lg">
          Not your coaching report
        </Title>
        <p className="rs-match-card__meta">
          Only the coach on this outside session can file the coaching report.
        </p>
        <Button variant="secondary" onClick={goBack}>
          ← {backLabel}
        </Button>
      </div>
    );
  }

  return (
    <Navigate
      to={cmoReportPath(outsideMatchId(session.id), session.refereeId)}
      replace
    />
  );
}
