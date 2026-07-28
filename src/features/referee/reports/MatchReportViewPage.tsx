import type { ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Button, Title } from '@patternfly/react-core';
import { useApp } from '@/app/AppContext';
import {
  CMO_SCALE_LABELS,
  COMPETITION_UNION_LABELS,
  type CmoScaleKey,
} from '@/domain/reports';
import { crewPeople, REQUESTABLE_SLOT_SHORT } from '@/domain/types';
import { moDisplayNames } from '@/features/referee/appointments/crewLines';
import {
  MATCH_REPORTS_BACK,
  matchReportViewPath,
  resolveSubmittedMatchReport,
  submittedMatchReportsForMatch,
} from '@/features/referee/reports/reportLinks';
import { MatchListRow } from '@/ui/MatchListRow';
import { backState } from '@/nav/backNav';

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  if (children == null || children === '') return null;
  return (
    <div className="rs-report-view__field">
      <div className="rs-report-view__label">{label}</div>
      <div className="rs-report-view__value">{children}</div>
    </div>
  );
}

export function MatchReportViewPage() {
  const { matchId = '' } = useParams();
  const [params] = useSearchParams();
  const { currentUser, state, isAssignerView } = useApp();
  const navigate = useNavigate();

  const match = state.matches.find((m) => m.id === matchId);
  const siblings = submittedMatchReportsForMatch(state.matchReports, matchId);
  const report = resolveSubmittedMatchReport(state.matchReports, matchId, {
    officialId: params.get('officialId') ?? undefined,
    slot: params.get('slot') ?? undefined,
  });

  if (!currentUser) return null;

  if (!match) {
    return (
      <div className="rs-stack">
        <Title headingLevel="h2" size="lg">
          Match not found
        </Title>
        <Button variant="link" onClick={() => navigate('/referee/reports/match')}>
          Back to Match Reports
        </Button>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="rs-stack">
        <button
          type="button"
          className="rs-detail__back"
          onClick={() => navigate(`/matches/${matchId}`, { state: backState(MATCH_REPORTS_BACK) })}
        >
          ← Match
        </button>
        <Title headingLevel="h2" size="lg">
          No submitted match report
        </Title>
        <p className="rs-match-card__meta">
          {match.homeTeamName} vs {match.awayTeamName}
        </p>
        <Button
          variant="secondary"
          onClick={() => navigate(`/matches/${matchId}`)}
        >
          Back to match
        </Button>
      </div>
    );
  }

  const mo = report.moPayload;
  const ar = report.arPayload;
  const kindLabel =
    report.formKind === 'mo_performance'
      ? 'Performance'
      : report.formKind === 'mo_quick'
        ? 'Quick'
        : report.formKind === 'ar_basic'
          ? 'AR'
          : report.slot.toUpperCase();

  return (
    <div className="rs-stack rs-report-view">
      <button
        type="button"
        className="rs-detail__back"
        onClick={() => navigate(-1)}
      >
        ← Back
      </button>
      <Title headingLevel="h2" size="lg">
        Match report ({kindLabel})
      </Title>
      <MatchListRow match={match} showTime />
      <p className="rs-match-card__meta">
        {REQUESTABLE_SLOT_SHORT[report.slot]} · Submitted
        {report.submittedAt
          ? ` · ${new Date(report.submittedAt).toLocaleString()}`
          : ''}
      </p>

      {siblings.length > 1 && (
        <div className="rs-report-view__siblings">
          <span className="rs-match-card__meta">Other reports on this match:</span>
          <div className="rs-slot-picker">
            {siblings.map((s) => (
              <Link
                key={s.id}
                to={matchReportViewPath(matchId, {
                  officialId: s.officialId,
                  slot: s.slot,
                })}
                className={`rs-filter-chip${
                  s.id === report.id ? ' rs-filter-chip--selected' : ''
                }`}
              >
                {REQUESTABLE_SLOT_SHORT[s.slot]}
              </Link>
            ))}
          </div>
        </div>
      )}

      {mo && (
        <>
          <Field label="Referee">{mo.refereeName}</Field>
          <Field label="Match date">{mo.matchDate}</Field>
          <Field label="Format">{mo.format}</Field>
          <Field label="Division">{mo.division}</Field>
          <Field label="Score">
            {mo.homeTeamName ?? match.homeTeamName} {mo.homePoints} –{' '}
            {mo.awayPoints} {mo.awayTeamName ?? match.awayTeamName}
          </Field>
          <Field label="Cards">
            Home YC {mo.homeYellowCards ?? '–'} / RC {mo.homeRedCards ?? '–'} ·
            Away YC {mo.awayYellowCards ?? '–'} / RC {mo.awayRedCards ?? '–'}
            {(mo.yellowCards != null || mo.redCards != null) &&
              ` (totals Y${mo.yellowCards ?? 0} R${mo.redCards ?? 0})`}
          </Field>
          {mo.crewAttendance && mo.crewAttendance.length > 0 && (
            <Field label="Crew attendance">
              <ul className="rs-crew-attend">
                {mo.crewAttendance.map((c) => (
                  <li key={`${c.slot}-${c.userId}`}>
                    {REQUESTABLE_SLOT_SHORT[c.slot]} · {c.userName}
                    {c.attended ? '' : ' — absent'}
                  </li>
                ))}
              </ul>
            </Field>
          )}
          <Field label="Absence note">{mo.crewAbsenceNote}</Field>
          {isAssignerView && (
            <Field label="Referee team issues (Scheduler only)">
              {mo.crewIssuesNote || '—'}
            </Field>
          )}
          <Field label="Light feedback">{mo.lightFeedback}</Field>
          <Field label="Game temperature">{mo.gameTemperature}</Field>
          <Field label="Control & flow">{mo.controlAndFlow}</Field>
          <Field label="Today I performed">{mo.todayIPerformed}</Field>
          <Field label="Key moment / decision">
            {mo.decidedAndWhy ?? mo.typeOfMoment}
          </Field>
          <Field label="Breakdown rewards">
            {mo.breakdownRewards?.length
              ? mo.breakdownRewards.join(', ')
              : null}
          </Field>
          <Field label="Set piece challenge">{mo.setPieceChallenge}</Field>
          <Field label="Advantage use">{mo.advantageUse}</Field>
          <Field label="Non-card problems">{mo.nonCardProblems}</Field>
          <Field label="Other comments / link">{mo.otherCommentsOrLink}</Field>
        </>
      )}

      {ar && (
        <>
          <Field label="Still comfortable at this level?">
            {ar.stillComfortable || '—'}
          </Field>
          <Field label="Key incidents">{ar.keyIncidents}</Field>
          <Field label="Note">{ar.note}</Field>
        </>
      )}

      {!mo && !ar && (
        <p className="rs-match-card__meta">Report on file (no payload detail).</p>
      )}
    </div>
  );
}

export function CmoReportViewPage() {
  const { matchId = '' } = useParams();
  const { currentUser, state } = useApp();
  const navigate = useNavigate();

  const match = state.matches.find((m) => m.id === matchId);
  const report = state.matchReports.find(
    (r) =>
      r.matchId === matchId &&
      r.slot === 'cmo' &&
      r.status === 'submitted',
  );

  if (!currentUser) return null;

  if (!match || !report) {
    return (
      <div className="rs-stack">
        <Title headingLevel="h2" size="lg">
          No submitted CMO report
        </Title>
        <Button
          variant="secondary"
          onClick={() =>
            navigate(
              match ? `/matches/${match.id}` : '/referee/reports/coaching',
            )
          }
        >
          Back
        </Button>
      </div>
    );
  }

  const p = report.cmoPayload;
  const scaleKeys = Object.keys(CMO_SCALE_LABELS) as CmoScaleKey[];
  const youFiled = report.officialId === currentUser.uid;
  const aboutYou =
    crewPeople(match.crew.mo).some((a) => a.userId === currentUser.uid) &&
    !youFiled;
  const author =
    state.users.find((u) => u.uid === report.officialId)?.displayName ??
    'CMO';
  const moName = moDisplayNames(match);

  return (
    <div className="rs-stack rs-report-view">
      <button
        type="button"
        className="rs-detail__back"
        onClick={() => navigate(-1)}
      >
        ← Back
      </button>
      <Title headingLevel="h2" size="lg">
        {youFiled
          ? 'CMO report you filed'
          : aboutYou
            ? 'Coaching report about you'
            : 'CMO coaching report'}
      </Title>
      <p className="rs-match-card__meta">
        {youFiled
          ? `You filed this as CMO · about ${moName} (Match Official)`
          : aboutYou
            ? `Filed by ${author} as CMO · about you (Match Official)`
            : `Filed by ${author} as CMO · about ${moName} (Match Official)`}
      </p>
      <MatchListRow match={match} showTime />
      <p className="rs-match-card__meta">
        Submitted
        {report.submittedAt
          ? ` · ${new Date(report.submittedAt).toLocaleString()}`
          : ''}
      </p>
      {p ? (
        <>
          {scaleKeys.map((key) => (
            <Field key={key} label={CMO_SCALE_LABELS[key]}>
              {p.scales[key] != null ? (
                <>
                  {p.scales[key]}/5
                  {p.comments[key] ? ` — ${p.comments[key]}` : ''}
                </>
              ) : null}
            </Field>
          ))}
          <Field label="Overall comment">{p.overallComment}</Field>
        </>
      ) : (
        <p className="rs-match-card__meta">Report on file (no payload detail).</p>
      )}
    </div>
  );
}

/** Read-only card report body shared by CardReportPage. */
export function CardReportViewBody({
  matchId,
}: {
  matchId: string;
}) {
  const { state, isAssignerView } = useApp();
  const match = state.matches.find((m) => m.id === matchId);
  const report = state.cardReports.find(
    (c) => c.matchId === matchId && c.status === 'submitted',
  );
  if (!match || !report) return null;

  return (
    <div className="rs-stack rs-report-view">
      <MatchListRow match={match} showTime />
      <Field label="Official">{report.officialName}</Field>
      <Field label="Email">{report.officialEmail}</Field>
      <Field label="Phone">{report.officialPhone}</Field>
      <Field label="Match date">{report.matchDate}</Field>
      <Field label="Competition union">
        {report.competitionUnion
          ? COMPETITION_UNION_LABELS[report.competitionUnion]
          : '—'}
      </Field>
      {report.cards.map((c, i) => (
        <div key={c.id} className="rs-team-score-card">
          <strong>
            Card {i + 1} · {c.color === 'yellow' ? 'Yellow' : 'Red'}
          </strong>
          <Field label="Player">{c.playerName}</Field>
          <Field label="Team">{c.teamName}</Field>
          <Field label="Minute">{c.minute}</Field>
          <Field label="Reason">{c.reason}</Field>
        </div>
      ))}
      {isAssignerView && (
        <Field label="Additional information (Scheduler only)">
          {report.additionalInfoPrivate || '—'}
        </Field>
      )}
    </div>
  );
}
