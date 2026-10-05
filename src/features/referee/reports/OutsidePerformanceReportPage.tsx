import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Title } from '@patternfly/react-core';
import { useApp } from '@/app/AppContext';
import { matchFromOutsideSession } from '@/domain/outsideCoaching';
import { PerformanceReportForm } from '@/features/referee/reports/PerformanceReportForm';
import {
  COACHING_MINE_BACK,
  outsideCmoViewPath,
} from '@/features/referee/reports/reportLinks';
import { useAppBack } from '@/nav/backNav';
import {
  ensureOutsidePerformanceReady,
  ensureOutsidePerformanceReadyDemo,
  persistSubmittedMatchReport,
} from '@/services/reportsLive';
import type { MoReportPayload } from '@/domain/reports';

export function OutsidePerformanceReportPage() {
  const { sessionId = '' } = useParams();
  const { currentUser, state, store, dataMode } = useApp();
  const navigate = useNavigate();
  const { goBack, backLabel } = useAppBack(COACHING_MINE_BACK);
  const [error, setError] = useState<string | null>(null);

  const session = state.outsideCoachingSessions.find((s) => s.id === sessionId);
  const match = useMemo(
    () => (session ? matchFromOutsideSession(session) : undefined),
    [session],
  );

  const report = useMemo(() => {
    if (!currentUser || !sessionId) return undefined;
    return state.matchReports.find(
      (r) =>
        r.outsideSessionId === sessionId &&
        r.slot === 'mo' &&
        r.officialId === currentUser.uid,
    );
  }, [currentUser, sessionId, state.matchReports]);

  useEffect(() => {
    if (!currentUser || !sessionId) return;
    if (dataMode === 'live') {
      void ensureOutsidePerformanceReady(sessionId, currentUser.uid).catch(
        (err) => {
          console.error('ensureOutsidePerformanceReady failed', err);
          setError(
            err instanceof Error
              ? err.message
              : 'Could not open performance report.',
          );
        },
      );
    } else {
      ensureOutsidePerformanceReadyDemo(sessionId, currentUser.uid);
    }
  }, [dataMode, currentUser?.uid, sessionId]);

  if (!currentUser) return null;

  if (!session || !match) {
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

  if (session.refereeId !== currentUser.uid) {
    return (
      <div className="rs-stack">
        <Title headingLevel="h2" size="lg">
          Not your performance report
        </Title>
        <p className="rs-match-card__meta">
          Only the referee on this outside session can file the performance
          report.
        </p>
        <Button variant="secondary" onClick={goBack}>
          ← {backLabel}
        </Button>
      </div>
    );
  }

  if (report?.status === 'submitted') {
    return (
      <div className="rs-stack">
        <button type="button" className="rs-detail__back" onClick={goBack}>
          ← {backLabel}
        </button>
        <Title headingLevel="h2" size="lg">
          Performance report submitted
        </Title>
        <p className="rs-match-card__meta">
          {match.homeTeamName} vs {match.awayTeamName}
        </p>
        <Button
          variant="secondary"
          onClick={() => navigate(outsideCmoViewPath(sessionId))}
        >
          View coaching report
        </Button>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="rs-stack">
        <Title headingLevel="h2" size="lg">
          Opening performance report…
        </Title>
        {error && (
          <p className="rs-form-error-banner" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }

  const onSubmit = async (payload: MoReportPayload) => {
    setError(null);
    try {
      if (dataMode === 'live') {
        await persistSubmittedMatchReport(
          report.id,
          'mo_performance',
          payload,
        );
      } else {
        store.submitMatchReport(report.id, 'mo_performance', payload);
      }
      navigate(outsideCmoViewPath(sessionId));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not save performance report.',
      );
    }
  };

  return (
    <div className="rs-stack">
      <button type="button" className="rs-detail__back" onClick={goBack}>
        ← {backLabel}
      </button>
      <Title headingLevel="h2" size="lg">
        Outside performance report
      </Title>
      <p className="rs-match-card__meta">
        {match.homeTeamName} vs {match.awayTeamName} · {session.matchDate}
      </p>
      {error && (
        <p className="rs-form-error-banner" role="alert">
          {error}
        </p>
      )}
      <PerformanceReportForm
        match={match}
        user={currentUser}
        cmoDidNotAttend={false}
        initial={report.moPayload}
        onBack={goBack}
        onSubmit={(payload) => {
          void onSubmit(payload);
        }}
      />
    </div>
  );
}
