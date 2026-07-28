import { Link } from 'react-router-dom';
import { genderLabel, type Match } from '@/domain/types';
import type { ReactNode } from 'react';
import { backState, type BackNav } from '@/nav/backNav';

function dayOrdinal(day: number): string {
  const j = day % 10;
  const k = day % 100;
  if (k >= 11 && k <= 13) return `${day}th`;
  if (j === 1) return `${day}st`;
  if (j === 2) return `${day}nd`;
  if (j === 3) return `${day}rd`;
  return `${day}th`;
}

function formatCardDate(iso: string): { month: string; day: string } {
  const d = new Date(iso);
  const month = d.toLocaleDateString(undefined, { month: 'short' });
  return { month, day: dayOrdinal(d.getDate()) };
}

function formatKickoffTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function hasMatchScore(match: Match): boolean {
  return (
    match.homeScore != null &&
    match.awayScore != null &&
    Number.isFinite(match.homeScore) &&
    Number.isFinite(match.awayScore)
  );
}

export function MatchListRow({
  match,
  to,
  trailing,
  meta,
  showTime = false,
  /** Hide score column (e.g. pre-report — scores not filed yet). */
  hideScore = false,
  /** Event | trailing split. `crew` = 3/5·2/5, `action` = 4/5·1/5 (raise-hand). */
  split = 'crew',
  /** Urgent assigner call-out — red card surface. */
  urgent = false,
  /** Waiting state — yellow card surface (e.g. teams done, refs pending). */
  warn = false,
  /** Descriptive back target for the match detail screen. */
  back,
}: {
  match: Match;
  to?: string;
  trailing?: ReactNode;
  meta?: ReactNode;
  showTime?: boolean;
  hideScore?: boolean;
  split?: 'crew' | 'action';
  urgent?: boolean;
  warn?: boolean;
  back?: BackNav;
}) {
  const { month, day } = formatCardDate(match.kickoffAt);
  const scored = !hideScore && hasMatchScore(match);
  const homeScoreLabel = scored ? String(match.homeScore) : '–';
  const awayScoreLabel = scored ? String(match.awayScore) : '–';
  const main = (
    <>
      <div className="rs-list-row__date" aria-hidden>
        <span className="rs-list-row__month">{month}</span>
        <span className="rs-list-row__day">{day}</span>
      </div>
      <div className="rs-list-row__body">
        <div className="rs-list-row__chips" aria-label="Game type">
          <span className="rs-pill rs-pill--ink rs-list-row__chip">
            {genderLabel(match.gender)}
          </span>
          <span className="rs-pill rs-pill--ink rs-list-row__chip">
            {match.level}
          </span>
        </div>
        <p className="rs-list-row__venue">
          {match.venueAddress?.trim() || match.venueName}
        </p>
        <p
          className="rs-list-row__teams"
          aria-label={
            scored
              ? `Score ${match.homeScore} to ${match.awayScore}`
              : undefined
          }
        >
          <span className="rs-list-row__side">
            <span className="rs-list-row__home">{match.homeTeamName}</span>
            <span
              className={`rs-list-row__score${scored ? '' : ' rs-list-row__score--empty'}`}
            >
              {homeScoreLabel}
            </span>
          </span>
          <span className="rs-list-row__side">
            <span className="rs-list-row__away">{match.awayTeamName}</span>
            <span
              className={`rs-list-row__score${scored ? '' : ' rs-list-row__score--empty'}`}
            >
              {awayScoreLabel}
            </span>
          </span>
        </p>
        {showTime && (
          <p className="rs-list-row__time">{formatKickoffTime(match.kickoffAt)}</p>
        )}
        {meta && <div className="rs-list-row__meta">{meta}</div>}
      </div>
    </>
  );

  const rowClass = [
    'rs-list-row',
    split === 'action' ? 'rs-list-row--action' : '',
    urgent ? 'rs-list-row--urgent' : '',
    !urgent && warn ? 'rs-list-row--warn' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={rowClass}>
      {to ? (
        <Link
          className="rs-list-row__main"
          to={to}
          state={back ? backState(back) : undefined}
        >
          {main}
        </Link>
      ) : (
        <div className="rs-list-row__main">{main}</div>
      )}
      {trailing && <div className="rs-list-row__trailing">{trailing}</div>}
    </div>
  );
}
