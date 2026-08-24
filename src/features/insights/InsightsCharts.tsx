import { Link } from 'react-router-dom';
import type { ReportTrendBucket } from '@/domain/insights';
import { formatInsightsAvg } from '@/features/insights/insightsFormat';

export function InsightsStatCard({
  to,
  title,
  count,
  avg,
  avgLabel,
}: {
  to: string;
  title: string;
  count: number;
  avg: number | null;
  avgLabel: string;
}) {
  return (
    <Link to={to} className="rs-insights-stat-card">
      <span className="rs-insights-stat-card__title">{title}</span>
      <span className="rs-insights-stat-card__count">{count}</span>
      <span className="rs-insights-stat-card__avg">
        {avgLabel}: {formatInsightsAvg(avg)}
      </span>
    </Link>
  );
}

/** Non-link stat tile (e.g. official quick look). */
export function InsightsStatTile({
  title,
  count,
  avg,
  avgLabel,
  meta,
}: {
  title: string;
  count: number | string;
  avg?: number | null;
  avgLabel?: string;
  meta?: string;
}) {
  return (
    <div className="rs-insights-stat-card rs-insights-stat-card--static">
      <span className="rs-insights-stat-card__title">{title}</span>
      <span className="rs-insights-stat-card__count">{count}</span>
      {avgLabel != null && (
        <span className="rs-insights-stat-card__avg">
          {avgLabel}: {formatInsightsAvg(avg ?? null)}
        </span>
      )}
      {meta && (
        <span className="rs-insights-stat-card__avg">{meta}</span>
      )}
    </div>
  );
}

type BarItem = {
  key: string;
  label: string;
  value: number;
  href?: string;
  meta?: string;
  max?: number;
};

export function InsightsHorizontalBars({
  items,
  valueLabel = 'count',
  ariaLabel,
}: {
  items: BarItem[];
  valueLabel?: string;
  ariaLabel: string;
}) {
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <ul className="rs-insights-bars" aria-label={ariaLabel}>
      {items.map((item) => {
        const pct = Math.round((item.value / max) * 100);
        const row = (
          <>
            <div className="rs-insights-bars__head">
              <span className="rs-insights-bars__label">{item.label}</span>
              <span className="rs-insights-bars__value">
                {item.value} {valueLabel}
                {item.meta ? ` · ${item.meta}` : ''}
              </span>
            </div>
            <div className="rs-insights-bars__track" aria-hidden>
              <span
                className="rs-insights-bars__fill"
                style={{ width: `${Math.max(pct, item.value > 0 ? 8 : 0)}%` }}
              />
            </div>
          </>
        );
        return (
          <li key={item.key} className="rs-insights-bars__row">
            {item.href ? (
              <Link to={item.href} className="rs-insights-bars__link">
                {row}
              </Link>
            ) : (
              row
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function InsightsCriterionBars({
  items,
  ariaLabel,
}: {
  items: { key: string; label: string; value: number }[];
  ariaLabel: string;
}) {
  const scaleMax = 5;
  return (
    <ul className="rs-insights-bars" aria-label={ariaLabel}>
      {items.map((item) => {
        const pct = Math.round((item.value / scaleMax) * 100);
        return (
          <li key={item.key} className="rs-insights-bars__row">
            <div className="rs-insights-bars__head">
              <span className="rs-insights-bars__label">{item.label}</span>
              <span className="rs-insights-bars__value">
                avg {formatInsightsAvg(item.value)}
              </span>
            </div>
            <div className="rs-insights-bars__track" aria-hidden>
              <span
                className="rs-insights-bars__fill rs-insights-bars__fill--rating"
                style={{ width: `${Math.max(pct, 4)}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function shortMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(undefined, {
    month: 'short',
    timeZone: 'UTC',
  });
}

export function InsightsTrendChart({
  buckets,
  ariaLabel,
}: {
  buckets: ReportTrendBucket[];
  ariaLabel: string;
}) {
  const max = Math.max(
    ...buckets.flatMap((b) => [b.coachCount, b.cmoCount]),
    1,
  );
  const yTicks = [0, Math.ceil(max / 2), max];
  const uniqueTicks = [...new Set(yTicks)].sort((a, b) => a - b);

  const hasData = buckets.some((b) => b.coachCount > 0 || b.cmoCount > 0);

  return (
    <div className="rs-insights-trend">
      <div className="rs-insights-trend__chart-wrap">
        <div className="rs-insights-trend__y-axis" aria-hidden>
          {uniqueTicks
            .slice()
            .reverse()
            .map((tick) => (
              <span key={tick} className="rs-insights-trend__y-tick">
                {tick}
              </span>
            ))}
        </div>
        <div className="rs-insights-trend__plot" role="img" aria-label={ariaLabel}>
          <div className="rs-insights-trend__grid-lines" aria-hidden>
            {uniqueTicks.map((tick) => (
              <div
                key={tick}
                className="rs-insights-trend__grid-line"
                style={{ bottom: `${(tick / max) * 100}%` }}
              />
            ))}
          </div>
          <div className="rs-insights-trend__bars">
            {buckets.map((b) => (
              <div key={b.monthKey} className="rs-insights-trend__month">
                <div className="rs-insights-trend__bar-group">
                  <div className="rs-insights-trend__bar-stack">
                    <span
                      className="rs-insights-trend__bar rs-insights-trend__bar--coach"
                      style={{
                        height: `${(b.coachCount / max) * 100}%`,
                      }}
                      title={`Coach feedback: ${b.coachCount}`}
                    >
                      {b.coachCount > 0 ? (
                        <span className="rs-insights-trend__bar-label">
                          {b.coachCount}
                        </span>
                      ) : null}
                    </span>
                  </div>
                  <div className="rs-insights-trend__bar-stack">
                    <span
                      className="rs-insights-trend__bar rs-insights-trend__bar--cmo"
                      style={{
                        height: `${(b.cmoCount / max) * 100}%`,
                      }}
                      title={`CMO reports: ${b.cmoCount}`}
                    >
                      {b.cmoCount > 0 ? (
                        <span className="rs-insights-trend__bar-label">
                          {b.cmoCount}
                        </span>
                      ) : null}
                    </span>
                  </div>
                </div>
                <span className="rs-insights-trend__x-label">
                  {shortMonthLabel(b.monthKey)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="rs-insights-trend__axis-caption">
        Y-axis: submitted reports per month · X-axis: calendar month
      </p>

      <div className="rs-insights-trend__legend">
        <span className="rs-insights-trend__legend-item rs-insights-trend__legend-item--coach">
          Coach feedback
        </span>
        <span className="rs-insights-trend__legend-item rs-insights-trend__legend-item--cmo">
          CMO reports
        </span>
      </div>

      <table className="rs-insights-trend__table">
        <caption className="rs-insights-trend__table-caption">
          Monthly report counts
        </caption>
        <thead>
          <tr>
            <th scope="col">Month</th>
            <th scope="col">Coach</th>
            <th scope="col">CMO</th>
          </tr>
        </thead>
        <tbody>
          {buckets.map((b) => (
            <tr key={b.monthKey}>
              <td>{b.label}</td>
              <td>{b.coachCount}</td>
              <td>{b.cmoCount}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {!hasData && (
        <p className="rs-detail-note">
          No submitted reports in this window yet. Counts will appear here as
          coaches and CMOs file feedback after matches.
        </p>
      )}
    </div>
  );
}
