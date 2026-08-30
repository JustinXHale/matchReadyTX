import { Link } from 'react-router-dom';
import type { CSSProperties } from 'react';
import { InsightsStatCard } from '@/features/insights/InsightsCharts';

export type JudicialStackedBarItem = {
  key: string;
  label: string;
  yellow: number;
  red: number;
  hrefYellow?: string;
  hrefRed?: string;
  href?: string;
};

export function JudicialDonutHero({
  to,
  totalCards,
  yellowPct,
}: {
  to: string;
  totalCards: number;
  yellowPct: number;
}) {
  return (
    <Link to={to} className="rs-insights-stat-card rs-judicial-donut-hero">
      <span className="rs-insights-stat-card__title">Total cards</span>
      <div className="rs-judicial-donut rs-judicial-donut--hero">
        <div
          className="rs-judicial-donut__swatch rs-judicial-donut__swatch--split"
          style={
            {
              ['--rs-yellow-pct']: String(yellowPct || 0),
            } as CSSProperties
          }
          aria-hidden
        />
        <span className="rs-judicial-donut__center">{totalCards}</span>
      </div>
    </Link>
  );
}

export { InsightsStatCard };

export function JudicialStackedBars({
  items,
  ariaLabel,
}: {
  items: JudicialStackedBarItem[];
  ariaLabel: string;
}) {
  const max = Math.max(...items.map((i) => i.yellow + i.red), 1);
  return (
    <ul className="rs-judicial-stacked-bars" aria-label={ariaLabel}>
      {items.map((item) => {
        const total = item.yellow + item.red;
        const totalPct = Math.round((total / max) * 100);
        return (
          <li key={item.key} className="rs-judicial-stacked-bars__row">
            <div className="rs-judicial-stacked-bars__head">
              {item.href ? (
                <Link to={item.href} className="rs-judicial-stacked-bars__label">
                  {item.label}
                </Link>
              ) : (
                <span className="rs-judicial-stacked-bars__label">
                  {item.label}
                </span>
              )}
              <span className="rs-judicial-stacked-bars__value">
                {total} · Y{item.yellow} R{item.red}
              </span>
            </div>
            <div
              className="rs-judicial-stacked-bars__track"
              style={{ width: `${Math.max(totalPct, total > 0 ? 12 : 0)}%` }}
              aria-hidden
            >
              {item.yellow > 0 &&
                (item.hrefYellow ? (
                  <Link
                    to={item.hrefYellow}
                    className="rs-judicial-stacked-bars__seg rs-judicial-stacked-bars__seg--yellow"
                    style={{ flexGrow: item.yellow }}
                    aria-label={`${item.label} yellow cards`}
                  />
                ) : (
                  <span
                    className="rs-judicial-stacked-bars__seg rs-judicial-stacked-bars__seg--yellow"
                    style={{ flexGrow: item.yellow }}
                  />
                ))}
              {item.red > 0 &&
                (item.hrefRed ? (
                  <Link
                    to={item.hrefRed}
                    className="rs-judicial-stacked-bars__seg rs-judicial-stacked-bars__seg--red"
                    style={{ flexGrow: item.red }}
                    aria-label={`${item.label} red cards`}
                  />
                ) : (
                  <span
                    className="rs-judicial-stacked-bars__seg rs-judicial-stacked-bars__seg--red"
                    style={{ flexGrow: item.red }}
                  />
                ))}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
