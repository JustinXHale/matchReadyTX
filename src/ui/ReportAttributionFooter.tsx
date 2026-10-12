import { Link } from 'react-router-dom';

export function ReportAttributionFooter({
  rating,
  position,
  refereeName,
  refereeHref,
}: {
  rating: string;
  position: string;
  refereeName: string;
  refereeHref?: string;
}) {
  const name = refereeName.trim() || 'Official';
  return (
    <div
      className="rs-report-attribution"
      role="group"
      aria-label={`Rating ${rating}, position ${position}, referee ${name}`}
    >
      <span className="rs-pill rs-report-attribution__rating">{rating}</span>
      <strong className="rs-report-attribution__position">{position}</strong>
      {refereeHref ? (
        <Link
          to={refereeHref}
          className="rs-report-attribution__name"
          onClick={(event) => event.stopPropagation()}
        >
          {name}
        </Link>
      ) : (
        <span className="rs-report-attribution__name">{name}</span>
      )}
    </div>
  );
}
