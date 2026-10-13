import { Card } from '@mui/material';
import { Link } from 'react-router-dom';
import {
  formatMatchCardWeekday,
  formatMatchKickoffTime,
  orgTimeZone,
} from '@/domain/matchTime';
import { matchGameplayFormat } from '@/domain/matchGameplayFormat';
import {
  formatTeamDisplayLabel,
  matchCardEventLabel,
  matchTeamConfirmationState,
  matchTeamDisplayNames,
  type TeamConfirmationState,
  type TeamDisplayLabel,
} from '@/domain/matchCardFooter';
import {
  isComplianceHeld,
  shouldShowComplianceHoldUi,
} from '@/domain/complianceHold';
import { statusLabel } from '@/domain/matchTransitions';
import { isMatchDidNotPlay } from '@/domain/requests';
import { genderLabel, type Match } from '@/domain/types';
import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { backState, type BackNav } from '@/nav/backNav';
import { useApp } from '@/app/AppContext';

function dayOrdinal(day: number): string {
  const j = day % 10;
  const k = day % 100;
  if (k >= 11 && k <= 13) return `${day}th`;
  if (j === 1) return `${day}st`;
  if (j === 2) return `${day}nd`;
  if (j === 3) return `${day}rd`;
  return `${day}th`;
}

function formatCardDate(
  iso: string,
  timeZone: string,
): { month: string; day: string } {
  const d = new Date(iso);
  const month = d.toLocaleDateString(undefined, {
    month: 'short',
    timeZone,
  });
  const dayNum = Number(
    d.toLocaleDateString(undefined, { day: 'numeric', timeZone }),
  );
  return { month, day: dayOrdinal(dayNum) };
}

function SideLabel({
  label,
  ha,
  className,
  confirmation,
}: {
  label: TeamDisplayLabel;
  ha: 'H' | 'A';
  className: string;
  confirmation: TeamConfirmationState;
}) {
  const confirmationLabel =
    confirmation === 'confirmed' ? 'Confirmed' : 'Unconfirmed';
  return (
    <span className="rs-list-row__name">
      <span className="rs-list-row__ha" aria-hidden>
        ({ha})
      </span>
      <span className={className}>
        {label.name}
        {label.abbreviation ? (
          <span className="rs-list-row__team-abbr"> ({label.abbreviation})</span>
        ) : null}
      </span>
      {confirmation ? (
        <span
          className={`rs-pill rs-list-row__team-confirmation rs-list-row__team-confirmation--${confirmation}`}
        >
          {confirmationLabel}
        </span>
      ) : null}
    </span>
  );
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
  topBanner,
  footer,
  meta,
  showTime = false,
  /** Hide score column (e.g. pre-report — scores not filed yet). */
  hideScore = false,
  /**
   * `stack` = home/away on two lines (default).
   * `inline` = one line: home name · home score — away score · away name.
   */
  teamsLayout = 'stack',
  /** Event | trailing split. `crew` = 3/5·2/5, `action` = 4/5·1/5 (raise-hand), `appt` = tighter crew column. */
  split = 'crew',
  /**
   * When true and `to` is set, the link wraps main + trailing so the whole
   * card (except `aside`) is clickable.
   */
  linkWholeCard = false,
  /** Urgent assigner call-out — red card surface. */
  urgent = false,
  urgentFilled = false,
  /** Waiting state — yellow card surface (e.g. teams done, refs pending). */
  warn = false,
  submitted = false,
  /** Descriptive back target for the match detail screen. */
  back,
}: {
  match: Match;
  to?: string;
  trailing?: ReactNode;
  /** Full-width status/attention surface above the primary row. */
  topBanner?: ReactNode;
  /** Full-width supporting surface below the primary row. */
  footer?: ReactNode;
  /** Sibling outside the link (e.g. Decline) — does not navigate. */
  aside?: ReactNode;
  meta?: ReactNode;
  showTime?: boolean;
  hideScore?: boolean;
  teamsLayout?: 'stack' | 'inline';
  split?: 'crew' | 'action' | 'appt';
  linkWholeCard?: boolean;
  urgent?: boolean;
  /** Solid error-container treatment for urgent report obligations. */
  urgentFilled?: boolean;
  warn?: boolean;
  /** Completed report/list treatment with a quieter contained surface. */
  submitted?: boolean;
  back?: BackNav;
}) {
  const { state, roleView } = useApp();
  const timeZone = orgTimeZone(state.org.timezone);
  const teamsById = useMemo(
    () => new Map(state.teams.map((t) => [t.id, t])),
    [state.teams],
  );
  const { home: homeTeam, away: awayTeam } = useMemo(
    () => matchTeamDisplayNames(match, teamsById),
    [match, teamsById],
  );
  const homeTeamName = formatTeamDisplayLabel(homeTeam);
  const awayTeamName = formatTeamDisplayLabel(awayTeam);
  const eventLabel = matchCardEventLabel(match);
  const homeConfirmation = matchTeamConfirmationState(match, 'home');
  const awayConfirmation = matchTeamConfirmationState(match, 'away');
  const homeConfirmationText = homeConfirmation
    ? `, ${homeConfirmation}`
    : '';
  const awayConfirmationText = awayConfirmation
    ? `, ${awayConfirmation}`
    : '';
  const { month, day } = formatCardDate(match.kickoffAt, timeZone);
  const weekday = formatMatchCardWeekday(match.kickoffAt, timeZone);
  const linkState = back ? backState(back) : undefined;
  const scored = !hideScore && hasMatchScore(match);
  const homeScoreLabel = scored ? String(match.homeScore) : '–';
  const awayScoreLabel = scored ? String(match.awayScore) : '–';
  const format = matchGameplayFormat(match);
  const matchTypeLabel = match.matchType?.trim();
  const showMatchTypeLabel = matchTypeLabel && !format;

  const teams =
    teamsLayout === 'inline' ? (
      <p
        className="rs-list-row__teams rs-list-row__teams--inline"
        aria-label={
          scored
            ? `Home ${homeTeamName}${homeConfirmationText}, score ${match.homeScore}; away ${awayTeamName}${awayConfirmationText}, score ${match.awayScore}`
            : `Home ${homeTeamName}${homeConfirmationText}; away ${awayTeamName}${awayConfirmationText}`
        }
      >
        <SideLabel
          label={homeTeam}
          ha="H"
          className="rs-list-row__inline-home"
          confirmation={homeConfirmation}
        />
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
        <span className="rs-list-row__inline-away-wrap">
          <SideLabel
            label={awayTeam}
            ha="A"
            className="rs-list-row__inline-away"
            confirmation={awayConfirmation}
          />
        </span>
      </p>
    ) : (
      <p
        className="rs-list-row__teams"
        aria-label={
          scored
            ? `Home ${homeTeamName}${homeConfirmationText}, score ${match.homeScore}; away ${awayTeamName}${awayConfirmationText}, score ${match.awayScore}`
            : `Home ${homeTeamName}${homeConfirmationText}; away ${awayTeamName}${awayConfirmationText}`
        }
      >
        <span className="rs-list-row__side">
          <SideLabel
            label={homeTeam}
            ha="H"
            className="rs-list-row__home"
            confirmation={homeConfirmation}
          />
          <span
            className={`rs-list-row__score${scored ? '' : ' rs-list-row__score--empty'}`}
          >
            {homeScoreLabel}
          </span>
        </span>
        <span className="rs-list-row__side">
          <SideLabel
            label={awayTeam}
            ha="A"
            className="rs-list-row__away"
            confirmation={awayConfirmation}
          />
          <span
            className={`rs-list-row__score${scored ? '' : ' rs-list-row__score--empty'}`}
          >
            {awayScoreLabel}
          </span>
        </span>
      </p>
    );

  const complianceLocked =
    isComplianceHeld(match) && shouldShowComplianceHoldUi(roleView);

  const main = (
    <>
      <div className="rs-list-row__main-inner">
        <div className="rs-list-row__date" aria-hidden>
          <span className="rs-list-row__month">{month}</span>
          <span className="rs-list-row__day">{day}</span>
          {weekday ? (
            <span className="rs-list-row__weekday">{weekday}</span>
          ) : null}
        </div>
        <div className="rs-list-row__body">
          <div
            className="rs-list-row__chips rs-list-row__chips--identity"
            aria-label="Game type"
          >
            <span className="rs-pill rs-pill--ink rs-list-row__chip">
              {genderLabel(match.gender)}
            </span>
            <span className="rs-pill rs-pill--ink rs-list-row__chip">
              {match.level}
            </span>
            {format ? (
              <span className="rs-pill rs-pill--quiet rs-list-row__chip">
                {format}
              </span>
            ) : null}
            {showMatchTypeLabel ? (
              <span className="rs-pill rs-pill--quiet rs-list-row__chip">
                {matchTypeLabel}
              </span>
            ) : null}
          </div>
          {(showTime || match.venueAddress?.trim() || match.venueName?.trim()) ? (
          <div className="rs-list-row__datetime-location">
            {showTime ? (
              <p className="rs-list-row__time">
                {formatMatchKickoffTime(match.kickoffAt, timeZone)}
              </p>
            ) : null}
            {showTime &&
            (match.venueAddress?.trim() || match.venueName?.trim()) ? (
              <span className="rs-list-row__meta-separator" aria-hidden>
                |
              </span>
            ) : null}
            {match.venueAddress?.trim() || match.venueName?.trim() ? (
              <p className="rs-list-row__venue">
                {match.venueAddress?.trim() || match.venueName}
              </p>
            ) : null}
          </div>
          ) : null}
          {eventLabel ? (
            <p className="rs-list-row__event-title">{eventLabel}</p>
          ) : null}
          {teams}
          {match.status === 'cancelled' ||
          match.status === 'postponed' ||
          match.playedForfeit ||
          match.forfeitTeamId ||
          (isComplianceHeld(match) && roleView === 'scheduler') ? (
            <div className="rs-list-row__chips" aria-label="Match status">
              {match.status === 'cancelled' || match.status === 'postponed' ? (
                <span className="rs-pill rs-pill--urgent rs-list-row__chip">
                  {statusLabel(match.status)}
                </span>
              ) : null}
              {match.playedForfeit ? (
                <span className="rs-pill rs-pill--urgent rs-list-row__chip">
                  Played forfeit
                </span>
              ) : null}
              {match.forfeitTeamId ? (
                <span className="rs-pill rs-pill--urgent rs-list-row__chip">
                  Forfeit
                </span>
              ) : null}
              {isComplianceHeld(match) && roleView === 'scheduler' ? (
                <span className="rs-pill rs-pill--warn rs-list-row__chip">
                  Locked
                </span>
              ) : null}
            </div>
          ) : null}
        {meta && <div className="rs-list-row__meta">{meta}</div>}
        </div>
      </div>
    </>
  );

  const isMutedOutcome = isMatchDidNotPlay(match);
  const rowClass = [
    'rs-list-row',
    split === 'action' ? 'rs-list-row--action' : '',
    split === 'appt' ? 'rs-list-row--appt' : '',
    aside ? 'rs-list-row--with-aside' : '',
    complianceLocked ? 'rs-list-row--compliance-locked' : '',
    !complianceLocked && urgent ? 'rs-list-row--urgent' : '',
    !complianceLocked && urgent && urgentFilled
      ? 'rs-list-row--urgent-filled'
      : '',
    !complianceLocked && !urgent && warn ? 'rs-list-row--warn' : '',
    !complianceLocked && !urgent && !warn && submitted
      ? 'rs-list-row--submitted'
      : '',
    !complianceLocked &&
    !urgent &&
    !warn &&
    isMutedOutcome
      ? 'rs-list-row--forfeit'
      : '',
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
        to={to!}
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
          to={to!}
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
    <Card
      component="div"
      elevation={0}
      className={rowClass}
      sx={{
        borderRadius: 'var(--rs-radius-card)',
        overflow: 'hidden',
        boxShadow: 'none',
      }}
    >
      {complianceLocked || topBanner ? (
        <div className="rs-list-row__top-banner" role="status">
          {complianceLocked ? (
            <span className="rs-list-row__locked-label">LOCKED</span>
          ) : (
            topBanner
          )}
        </div>
      ) : null}
      {body}
      {aside ? <div className="rs-list-row__aside">{aside}</div> : null}
      {footer ? <div className="rs-list-row__supporting-footer">{footer}</div> : null}
    </Card>
  );
}
