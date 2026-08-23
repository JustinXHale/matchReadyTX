import { useMemo } from 'react';
import { Title } from '@patternfly/react-core';
import { useApp, useAppHref } from '@/app/AppContext';
import {
  COACH_FEEDBACK_CRITERION_LABELS,
  COACH_FEEDBACK_SCALE_KEYS,
} from '@/domain/coachFeedback';
import {
  cmoReportStats,
  globalCoachFeedbackStats,
  gradePyramid,
  reportTrendByMonth,
} from '@/domain/insights';
import {
  InsightsCriterionBars,
  InsightsHorizontalBars,
  InsightsStatCard,
  InsightsTrendChart,
} from '@/features/insights/InsightsCharts';
import { formatInsightsAvg } from '@/features/insights/insightsFormat';

export function InsightsOverviewPage() {
  const { state } = useApp();
  const coachReportsHref = useAppHref('/insights/reports/coach-feedback');
  const cmoReportsHref = useAppHref('/insights/reports/cmo');
  const officialsHref = useAppHref('/insights/officials');

  const coachStats = globalCoachFeedbackStats(state.coachFeedback);
  const cmoStats = cmoReportStats(state.matchReports);
  const pyramid = gradePyramid(
    state.users,
    state.coachFeedback,
    state.matchReports,
    state.matches,
  );
  const trend = reportTrendByMonth(
    state.coachFeedback,
    state.matchReports,
    6,
  );

  const criterionBars = useMemo(() => {
    return COACH_FEEDBACK_SCALE_KEYS.filter((key) => key !== 'overall')
      .map((key) => ({
        key,
        label: COACH_FEEDBACK_CRITERION_LABELS[key],
        value: coachStats.criterionAverages[key] ?? 0,
      }))
      .filter((item) => item.value > 0);
  }, [coachStats.criterionAverages]);

  const gradeBars = pyramid.map((tier) => ({
    key: String(tier.level),
    label: tier.label,
    value: tier.officialCount,
    href: `${officialsHref}?grade=${tier.level}`,
    meta: [
      tier.avgCoachFeedback != null
        ? `coach ${formatInsightsAvg(tier.avgCoachFeedback)}`
        : null,
      tier.avgCmoRating != null
        ? `CMO ${formatInsightsAvg(tier.avgCmoRating)}`
        : null,
    ]
      .filter(Boolean)
      .join(' · '),
  }));

  return (
    <div className="rs-stack">
      <Title headingLevel="h1" size="lg">
        Dashboard
      </Title>
      <p className="rs-match-card__meta">
        Society-wide referee analytics. Tap a card or grade row to drill down.
      </p>

      <div className="rs-insights-stat-grid">
        <InsightsStatCard
          to={coachReportsHref}
          title="Coach feedback"
          count={coachStats.submittedCount}
          avg={coachStats.globalAverage}
          avgLabel="Avg rating (1–5)"
        />
        <InsightsStatCard
          to={cmoReportsHref}
          title="CMO coaching reports"
          count={cmoStats.submittedCount}
          avg={cmoStats.globalAverage}
          avgLabel="Avg assessed level"
        />
      </div>

      {criterionBars.length > 0 && (
        <section className="rs-detail-card" aria-labelledby="coach-criteria">
          <h2 id="coach-criteria" className="rs-detail-section__label">
            Coach ratings by area
          </h2>
          <p className="rs-detail-note">
            Average scores across all submitted team feedback (1–5 scale).
          </p>
          <InsightsCriterionBars
            ariaLabel="Average coach feedback by criterion"
            items={criterionBars}
          />
        </section>
      )}

      <section className="rs-detail-card" aria-labelledby="grade-pyramid">
        <h2 id="grade-pyramid" className="rs-detail-section__label">
          Officials by grade
        </h2>
        <p className="rs-detail-note">
          Level 6 (C1+) at top through Level 10 (C4). Bucketed by assessed
          level, or self-assessed when no assessed level is set. Tap a row to
          filter the Officials tab.
        </p>
        <InsightsHorizontalBars
          ariaLabel="Official count by grade tier"
          items={gradeBars}
        />
      </section>

      <section className="rs-detail-card" aria-labelledby="insights-trend">
        <h2 id="insights-trend" className="rs-detail-section__label">
          Reports over time
        </h2>
        <p className="rs-detail-note">
          Submitted coach feedback and CMO coaching reports by month.
        </p>
        <InsightsTrendChart
          buckets={trend}
          ariaLabel="Monthly coach feedback and CMO report counts"
        />
      </section>
    </div>
  );
}
