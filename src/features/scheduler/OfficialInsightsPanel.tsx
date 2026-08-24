import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useApp, useAppHref } from '@/app/AppContext';
import {
  COACH_FEEDBACK_CRITERION_LABELS,
  COACH_FEEDBACK_SCALE_KEYS,
} from '@/domain/coachFeedback';
import {
  officialCoachFeedbackStatsForUser,
  officialSeasonStats,
} from '@/domain/insights';
import {
  InsightsCriterionBars,
  InsightsHorizontalBars,
  InsightsStatCard,
  InsightsStatTile,
} from '@/features/insights/InsightsCharts';
import { formatInsightsAvg } from '@/features/insights/insightsFormat';
import '@/features/insights/insights.css';

type OfficialInsightsPanelProps = {
  userId: string;
  /** Scheduler-confidential team feedback — assigner lens only. */
  showCoachFeedback?: boolean;
  compact?: boolean;
};

/** Cumulative referee stats for quick look and member profile. */
export function OfficialInsightsPanel({
  userId,
  showCoachFeedback = true,
  compact = false,
}: OfficialInsightsPanelProps) {
  const { state } = useApp();
  const coachReportsHref = useAppHref('/insights/reports/coach-feedback');
  const cmoReportsHref = useAppHref('/insights/reports/cmo');
  const refereeCmoReceivedHref = useAppHref('/referee/reports/coaching/cmo');
  const refereeCmoFiledHref = useAppHref('/referee/reports/coaching/mine');
  const cmoCoachingLink = showCoachFeedback
    ? cmoReportsHref
    : refereeCmoReceivedHref;

  const stats = useMemo(
    () =>
      officialSeasonStats(
        userId,
        state.matches,
        state.matchReports,
        state.cardReports,
        showCoachFeedback ? state.coachFeedback : [],
      ),
    [
      userId,
      state.matches,
      state.matchReports,
      state.cardReports,
      state.coachFeedback,
      showCoachFeedback,
    ],
  );

  const coachCriteria = useMemo(() => {
    if (!showCoachFeedback) return [];
    const coachStats = officialCoachFeedbackStatsForUser(
      userId,
      state.coachFeedback,
    );
    return COACH_FEEDBACK_SCALE_KEYS
      .filter((key) => key !== 'overall')
      .map((key) => ({
        key,
        label: COACH_FEEDBACK_CRITERION_LABELS[key],
        value: coachStats.criterionAverages[key] ?? 0,
      }))
      .filter((item) => item.value > 0);
  }, [userId, state.coachFeedback, showCoachFeedback]);

  const roleBars = [
    { key: 'mo', label: 'Match official', value: stats.gamesMo },
    { key: 'ar', label: 'Assistant', value: stats.gamesAr },
    { key: 'cmo', label: 'CMO', value: stats.gamesCmo },
  ];

  return (
    <div className="rs-official-insights">
      <p className="rs-match-card__meta rs-official-insights__note">
        Season totals from completed games on file in this org.
      </p>

      <div className="rs-insights-stat-grid">
        <InsightsStatTile title="Games" count={stats.gamesPast} />
        <InsightsStatTile
          title="MO reports"
          count={stats.moReportsSubmitted}
          meta="submitted"
        />
        <InsightsStatTile
          title="Yellow cards"
          count={stats.yellowCards}
        />
        <InsightsStatTile title="Red cards" count={stats.redCards} />
        <InsightsStatTile
          title="Avg score margin"
          count={
            stats.avgScoreMargin != null
              ? formatInsightsAvg(stats.avgScoreMargin)
              : '—'
          }
          meta={
            stats.moGamesWithScore > 0
              ? `${stats.moGamesWithScore} MO games`
              : 'no scores yet'
          }
        />
      </div>

      {!compact && roleBars.some((b) => b.value > 0) && (
        <section aria-labelledby="official-insights-roles">
          <h3
            id="official-insights-roles"
            className="rs-detail-section__label"
          >
            Games by role
          </h3>
          <InsightsHorizontalBars
            items={roleBars}
            valueLabel="games"
            ariaLabel="Games by crew role"
          />
        </section>
      )}

      <section aria-labelledby="official-insights-feedback">
        <h3
          id="official-insights-feedback"
          className="rs-detail-section__label"
        >
          Feedback & coaching
        </h3>
        <div className="rs-insights-stat-grid">
          {showCoachFeedback ? (
            <InsightsStatCard
              to={coachReportsHref}
              title="Team feedback"
              count={stats.coachFeedbackCount}
              avg={stats.coachFeedbackAvg}
              avgLabel="avg"
            />
          ) : (
            <InsightsStatTile
              title="Team feedback"
              count="—"
              meta="confidential"
            />
          )}
          <InsightsStatCard
            to={cmoCoachingLink}
            title="CMO coaching"
            count={stats.cmoReportsReceived}
            avg={stats.cmoRatingAvg}
            avgLabel="avg grade"
          />
          <InsightsStatTile
            title="CMO reports filed"
            count={stats.cmoReportsFiled}
            meta="as CMO"
          />
        </div>
      </section>

      {showCoachFeedback && coachCriteria.length > 0 && !compact && (
        <section aria-labelledby="official-insights-coach-criteria">
          <h3
            id="official-insights-coach-criteria"
            className="rs-detail-section__label"
          >
            Team feedback criteria
          </h3>
          <InsightsCriterionBars
            items={coachCriteria}
            ariaLabel="Average team feedback by criterion"
          />
        </section>
      )}

      <p className="rs-match-card__meta">
        {showCoachFeedback ? (
          <>
            <Link className="rs-official-quicklook__link" to={cmoReportsHref}>
              Society CMO reports
            </Link>
            {' · '}
            <Link
              className="rs-official-quicklook__link"
              to={coachReportsHref}
            >
              Team feedback reports
            </Link>
          </>
        ) : (
          <>
            <Link
              className="rs-official-quicklook__link"
              to={refereeCmoReceivedHref}
            >
              CMO coaching received
            </Link>
            {' · '}
            <Link
              className="rs-official-quicklook__link"
              to={refereeCmoFiledHref}
            >
              CMO reports you filed
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
