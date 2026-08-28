import { Link } from 'react-router-dom';

/** Score pill(s) + person name — shared trailing layout for Insights-style report rows. */
export function InsightsReportTrailing({
  score,
  scoreHint,
  secondaryScore,
  secondaryHint,
  officialName,
  officialHref,
  namePrefix = 'MO',
}: {
  score: string;
  scoreHint?: string;
  secondaryScore?: string;
  secondaryHint?: string;
  officialName: string;
  officialHref?: string;
  namePrefix?: string;
}) {
  const name = namePrefix ? `${namePrefix} ${officialName}` : officialName;
  return (
    <div className="rs-coach-feedback-trailing">
      <div className="rs-coach-feedback-trailing__scores">
        <div className="rs-coach-feedback-trailing__score">
          <span className="rs-pill">{score}</span>
          {scoreHint ? (
            <span className="rs-coach-feedback-trailing__hint">{scoreHint}</span>
          ) : null}
        </div>
        {secondaryScore != null ? (
          <div className="rs-coach-feedback-trailing__score">
            <span className="rs-pill">{secondaryScore}</span>
            {secondaryHint ? (
              <span className="rs-coach-feedback-trailing__hint">
                {secondaryHint}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
      {officialHref ? (
        <Link
          to={officialHref}
          className="rs-coach-feedback-trailing__mo"
          onClick={(e) => e.stopPropagation()}
        >
          {name}
        </Link>
      ) : (
        <span className="rs-coach-feedback-trailing__mo">{name}</span>
      )}
    </div>
  );
}
