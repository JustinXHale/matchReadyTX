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
  aside,
  meta,
  showTime = false,
  /** Hide score column (e.g. pre-report — scores not filed yet). */
  hideScore = false,
  /**
   * `stack` = home/away on two lines (default).
   * `inline` = one line: home name · home score — away score · away name.
   */
  teamsLayout = 'stack',
  /** Event | trailing split. `crew` = 3/5·2/5, `action` = 4/5·1/5 (raise-hand). */
  split = 'crew',
  /**
   * When true and `to` is set, the link wraps main + trailing so the whole
   * card (except `aside`) is clickable.
   */
  linkWholeCard = false,
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
  /** Sibling outside the link (e.g. Decline) — does not navigate. */
  aside?: ReactNode;
  meta?: ReactNode;
  showTime?: boolean;
  hideScore?: boolean;
  teamsLayout?: 'stack' | 'inline';
  split?: 'crew' | 'action';
  linkWholeCard?: boolean;
  urgent?: boolean;
  warn?: boolean;
  back?: BackNav;
}) {
  const { month, day } = formatCardDate(match.kickoffAt);
  const scored = !hideScore && hasMatchScore(match);
  const homeScoreLabel = scored ? String(match.homeScore) : '–';
  const awayScoreLabel = scored ? String(match.awayScore) : '–';
  const linkState = back ? backState(back) : undefined;

  const teams =
    teamsLayout === 'inline' ? (
      <p
        className="rs-list-row__teams rs-list-row__teams--inline"
        aria-label={
          scored
            ? `Score ${match.homeScore} to ${match.awayScore}`
            : undefined
        }
      >
        <span className="rs-list-row__inline-home">{match.homeTeamName}</span>
        <span
          className={`rs-list-row__score${scored ? '' : ' rs-list-row__score--empty'}`}
        >
          {homeScoreLabel}
        </span>
        <span className="rs-list-row__score-sep" aria-hidden>
          –
        </span>
        <span
          className={`rs-list-row__score${scored ? '' : ' rs-list-row__score--empty'}`}
        >
          {awayScoreLabel}
        </span>
        <span className="rs-list-row__inline-away">{match.awayTeamName}</span>
      </p>
    ) : (
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
    );

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
        {teams}
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
    aside ? 'rs-list-row--with-aside' : '',
    urgent ? 'rs-list-row--urgent' : '',
    !urgent && warn ? 'rs-list-row--warn' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const trailingEl = trailing ? (
    <div className="rs-list-row__trailing">{trailing}</div>
  ) : null;

  let body: ReactNode;
  if (to && linkWholeCard) {
    body = (
      <Link
        className="rs-list-row__card-link"
        to={to}
        state={linkState}
      >
        <div className="rs-list-row__main">{main}</div>
        {trailingEl}
      </Link>
    );
  } else if (to) {
    body = (
      <>
        <Link
          className="rs-list-row__main"
          to={to}
          state={linkState}
        >
          {main}
        </Link>
        {trailingEl}
      </>
    );
  } else {
    body = (
      <>
        <div className="rs-list-row__main">{main}</div>
        {trailingEl}
      </>
    );
  }

  return (
    <div className={rowClass}>
      {body}
      {aside ? <div className="rs-list-row__aside">{aside}</div> : null}
    </div>
  );
}
