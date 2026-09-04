import type { ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Button, Title } from '@patternfly/react-core';
import { useApp } from '@/app/AppContext';
import {
  AR_COMFORT_QUESTION,
  CARD_CONFERENCE_LABELS,
  CMO_SCALE_KEYS,
  CMO_SCALE_LABELS,
  COMPETITION_UNION_LABELS,
  MATCH_FEEDBACK_LABEL,
  displayMatchForArchivedReport,
  displayMatchForCmoReport,
  displayPlayerName,
} from '@/domain/reports';
import { CARD_LAW_LABELS, isCardLawId } from '@/domain/cardLaws';
import { formatFivePointChoice } from '@/domain/fivePointScale';
import { crewPeople, REQUESTABLE_SLOT_SHORT } from '@/domain/types';
import { cmoSubjectName } from '@/features/insights/insightsDisplay';
import { moDisplayNames } from '@/features/referee/appointments/crewLines';
import {
  cmoReportViewPath,
  matchReportViewPath,
  COACHING_CMO_BACK,
  MATCH_REPORTS_BACK,
  resolveSubmittedMatchReport,
  submittedMatchReportsForMatch,
} from '@/features/referee/reports/reportLinks';
import { SubmittedPerformanceReportView } from '@/features/referee/reports/SubmittedPerformanceReportView';
import { useAppBack } from '@/nav/backNav';
import { MatchListRow } from '@/ui/MatchListRow';

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
  const { goBack, backLabel } = useAppBack(MATCH_REPORTS_BACK);

  const report = resolveSubmittedMatchReport(state.matchReports, matchId, {
    officialId: params.get('officialId') ?? undefined,
    slot: params.get('slot') ?? undefined,
  });
  const match =
    state.matches.find((m) => m.id === matchId) ??
    (report ? displayMatchForArchivedReport(report, state.matches) : undefined);
  const siblings = submittedMatchReportsForMatch(state.matchReports, matchId);

  if (!currentUser) return null;

  if (!report) {
    return (
      <div className="rs-stack">
        <Title headingLevel="h2" size="lg">
          No submitted match report
        </Title>
        <Button
          variant="secondary"
          onClick={() => navigate('/referee/reports/match')}
        >
          Back to Match Reports
        </Button>
      </div>
    );
  }

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
        onClick={goBack}
      >
        ← {backLabel}
      </button>
      <Title headingLevel="h2" size="lg">
        Match report ({kindLabel})
      </Title>
      <MatchListRow
        match={match}
        showTime={report.source !== 'legacy_form'}
      />
      <p className="rs-match-card__meta">
        {REQUESTABLE_SLOT_SHORT[report.slot]} · Submitted
        {report.source === 'legacy_form' ? ' · Imported' : ''}
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

      {mo && report.formKind === 'mo_performance' ? (
        <SubmittedPerformanceReportView mo={mo} match={match} />
      ) : mo ? (
        <>
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
          <Field label={MATCH_FEEDBACK_LABEL}>{mo.lightFeedback}</Field>
          <Field label="What went well">{mo.whatWentWell}</Field>
          <Field label="What to improve">{mo.whatToImprove}</Field>
          <Field label="Key decisions">{mo.keyDecisions}</Field>
          <Field label="Fitness / positioning">{mo.fitnessPositioning}</Field>
          <Field label="Other notes">{mo.otherNotes}</Field>
        </>
      ) : null}

      {ar && (
        <>
          <Field label={AR_COMFORT_QUESTION}>
            {ar.stillComfortable === 'yes'
              ? 'Yes'
              : ar.stillComfortable === 'no'
                ? 'No'
                : '—'}
          </Field>
          {ar.crewAttendance && ar.crewAttendance.length > 0 && (
            <Field label="Crew attendance">
              <ul className="rs-crew-attend">
                {ar.crewAttendance.map((c) => (
                  <li key={`${c.slot}-${c.userId}`}>
                    {REQUESTABLE_SLOT_SHORT[c.slot]} · {c.userName}
                    {c.attended ? '' : ' — absent'}
                  </li>
                ))}
              </ul>
            </Field>
          )}
          <Field label="Absence note">{ar.crewAbsenceNote}</Field>
          {isAssignerView && (
            <Field label="Referee team issues (Scheduler only)">
              {ar.crewIssuesNote || '—'}
            </Field>
          )}
          <Field label="Key incidents">{ar.keyIncidents}</Field>
          <Field label={MATCH_FEEDBACK_LABEL}>{ar.matchFeedback}</Field>
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
  const [searchParams] = useSearchParams();
  const subjectOfficialId = searchParams.get('subjectOfficialId') ?? undefined;
  const filerOfficialId = searchParams.get('officialId') ?? undefined;
  const { currentUser, state } = useApp();
  const navigate = useNavigate();
  const { goBack, backLabel } = useAppBack(COACHING_CMO_BACK);

  if (!currentUser) return null;

  const submittedOnMatch = state.matchReports.filter(
    (r) =>
      r.matchId === matchId &&
      r.slot === 'cmo' &&
      r.status === 'submitted',
  );

  const matchForChooser = state.matches.find((m) => m.id === matchId);

  if (
    matchForChooser &&
    !subjectOfficialId &&
    submittedOnMatch.length > 1 &&
    submittedOnMatch.some((r) => r.officialId === currentUser.uid)
  ) {
    return (
      <div className="rs-stack">
        <button
          type="button"
          className="rs-detail__back"
          onClick={goBack}
        >
          ← {backLabel}
        </button>
        <Title headingLevel="h2" size="lg">
          Choose coaching report
        </Title>
        <p className="rs-match-card__meta">
          {matchForChooser.homeTeamName} vs {matchForChooser.awayTeamName} —
          select which match official&apos;s report to view.
        </p>
        <ul className="rs-list">
          {submittedOnMatch
            .filter((r) => r.officialId === currentUser.uid)
            .map((r) => {
              const match = displayMatchForCmoReport(r, state.matches);
              if (!match) return null;
              const moName = cmoSubjectName(
                r,
                match,
                state.users,
                moDisplayNames(match),
              );
              return (
                <li key={r.id}>
                  <Link
                    className="rs-list-row"
                    to={cmoReportViewPath(matchId, r.subjectOfficialId, {
                      officialId: r.officialId,
                    })}
                  >
                    <span className="rs-list-row__title">{moName}</span>
                  </Link>
                </li>
              );
            })}
        </ul>
      </div>
    );
  }

  const report =
    (filerOfficialId && subjectOfficialId
      ? submittedOnMatch.find(
          (r) =>
            r.officialId === filerOfficialId &&
            r.subjectOfficialId === subjectOfficialId,
        )
      : subjectOfficialId
        ? submittedOnMatch.find(
            (r) =>
              r.subjectOfficialId === subjectOfficialId &&
              (filerOfficialId
                ? r.officialId === filerOfficialId
                : r.officialId === currentUser.uid),
          ) ?? submittedOnMatch.find(
            (r) => r.subjectOfficialId === subjectOfficialId,
          )
        : submittedOnMatch.find((r) => r.officialId === currentUser.uid)) ??
    submittedOnMatch[0];

  const match = report
    ? displayMatchForCmoReport(report, state.matches)
    : state.matches.find((m) => m.id === matchId);

  if (!match || !report) {
    return (
      <div className="rs-stack">
        <Title headingLevel="h2" size="lg">
          No submitted CMO report
        </Title>
        <Button
          variant="secondary"
          onClick={() =>
            navigate('/referee/reports/coaching')
          }
        >
          Back
        </Button>
      </div>
    );
  }

  const p = report.cmoPayload;
  const youFiled = report.officialId === currentUser.uid;
  const aboutYou =
    !youFiled &&
    (report.subjectOfficialId === currentUser.uid ||
      crewPeople(match.crew.mo).some((a) => a.userId === currentUser.uid));
  const author =
    state.users.find((u) => u.uid === report.officialId)?.displayName ??
    'CMO';
  const moName = cmoSubjectName(report, match, state.users, moDisplayNames(match));

  return (
    <div className="rs-stack rs-report-view">
      <button
        type="button"
        className="rs-detail__back"
        onClick={goBack}
      >
        ← {backLabel}
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
      <MatchListRow match={match} showTime={report.source !== 'legacy_form'} />
      <p className="rs-match-card__meta">
        Submitted
        {report.submittedAt
          ? ` · ${new Date(report.submittedAt).toLocaleString()}`
          : ''}
      </p>
      {p ? (
        <>
          <Title headingLevel="h3" size="md">
            Match context
          </Title>
          <Field label="Attended in person">
            {p.attendedInPerson === 'yes'
              ? 'Yes'
              : p.attendedInPerson === 'no'
                ? 'No'
                : null}
          </Field>
          <Field label="Video link">{p.videoLink}</Field>
          <Field label="This game played like">{p.playedLike}</Field>
          <Field label="Match type">{p.matchKind}</Field>
          <Field label="Game temperature">
            {p.gameTemperature != null ? `${p.gameTemperature}/5` : null}
          </Field>
          <Field label="Contest balance">
            {p.contestBalance != null ? `${p.contestBalance}/5` : null}
          </Field>
          <Field label="Complexity factors">
            {[
              ...(p.complexityFactors ?? []),
              p.complexityOther ? `Other: ${p.complexityOther}` : '',
            ]
              .filter(Boolean)
              .join(', ') || null}
          </Field>
          <Field label="Penalty count">{p.penaltyCount}</Field>

          <Title headingLevel="h3" size="md">
            Scales
          </Title>
          {CMO_SCALE_KEYS.map((key) => (
            <Field key={key} label={CMO_SCALE_LABELS[key]}>
              {p.scales[key] != null ? (
                <>
                  {formatFivePointChoice(p.scales[key])}
                  {p.comments[key] ? ` — ${p.comments[key]}` : ''}
                </>
              ) : null}
            </Field>
          ))}

          <Title headingLevel="h3" size="md">
            Coaching next steps
          </Title>
          <Field label="Keep">{p.keep}</Field>
          <Field label="Start">{p.start}</Field>
          <Field label="Stop">{p.stop}</Field>
          <Field label="Coach open comments">{p.overallComment}</Field>

          <Title headingLevel="h3" size="md">
            Referee snapshot
          </Title>
          <Field label="Assessed rating">
            {p.assessedRating != null
              ? `${p.assessedRating} (1 highest, 10 lowest)`
              : null}
          </Field>
          <Field label="Confidence in estimate">
            {p.gradingConfidence != null ? `${p.gradingConfidence}/5` : null}
          </Field>
          <Field label="Rationale on grading">{p.gradingRationale}</Field>
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
      {report.conference ? (
        <Field label="Conference">
          {CARD_CONFERENCE_LABELS[report.conference]}
        </Field>
      ) : null}
      {report.matchFilmed != null && (
        <Field label="Match filmed">{report.matchFilmed ? 'Yes' : 'No'}</Field>
      )}
      {(report.homeScore != null || report.awayScore != null) && (
        <Field label="Score">
          {report.homeScore ?? '—'}–{report.awayScore ?? '—'}
        </Field>
      )}
      {report.cards.map((c, i) => (
        <div key={c.id} className="rs-team-score-card">
          <strong>
            Card {i + 1} · {c.color === 'yellow' ? 'Yellow' : 'Red'}
          </strong>
          <Field label="Player">{displayPlayerName(c)}</Field>
          {c.playerJersey && <Field label="Jersey">{c.playerJersey}</Field>}
          {c.playerPosition && (
            <Field label="Position">{c.playerPosition}</Field>
          )}
          <Field label="Team">{c.teamName}</Field>
          <Field label="Time">{c.minute}</Field>
          <Field label="Summary">{c.offenseSummary || c.reason}</Field>
          {(c.lawIds ?? []).length > 0 && (
            <Field label="Laws">
              {(c.lawIds ?? [])
                .filter(isCardLawId)
                .map((id) => CARD_LAW_LABELS[id])
                .join('; ')}
            </Field>
          )}
          {c.receivedAnotherCard && c.secondOffense && (
            <Field label="Second card">
              {c.secondOffense.color === 'second_yellow_red'
                ? '2nd Yellow - Red'
                : 'Red'}{' '}
              · {c.secondOffense.approximateTime} · {c.secondOffense.summary}
            </Field>
          )}
          {isAssignerView && (
            <Field label="Additional information (Scheduler only)">
              {c.additionalInfoPrivate}
            </Field>
          )}
        </div>
      ))}
      {isAssignerView &&
        report.additionalInfoPrivate &&
        !report.cards.some((c) => c.additionalInfoPrivate) && (
          <Field label="Additional information (Scheduler only)">
            {report.additionalInfoPrivate}
          </Field>
        )}
    </div>
  );
}
