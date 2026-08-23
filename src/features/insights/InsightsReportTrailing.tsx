import { Link } from 'react-router-dom';

/** Score pill + MO name — shared trailing layout for Insights report list rows. */
export function InsightsReportTrailing({
  score,
  officialName,
  officialHref,
}: {
  score: string;
  officialName: string;
  officialHref?: string;
}) {
  return (
    <div className="rs-coach-feedback-trailing">
      <span className="rs-pill">{score}</span>
      {officialHref ? (
        <Link
          to={officialHref}
          className="rs-coach-feedback-trailing__mo"
          onClick={(e) => e.stopPropagation()}
        >
          MO {officialName}
        </Link>
      ) : (
        <span className="rs-coach-feedback-trailing__mo">MO {officialName}</span>
      )}
    </div>
  );
}
