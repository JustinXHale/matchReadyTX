import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { Button, Title } from '@patternfly/react-core';
import { Link, useParams } from 'react-router-dom';
import { useApp, useAppHref } from '@/app/AppContext';
import {
  COACH_FEEDBACK_COMMENT_BLOCKS,
  COACH_FEEDBACK_CRITERION_HINTS,
  COACH_FEEDBACK_CRITERION_LABELS,
  COACH_FEEDBACK_SCALE_KEYS,
  COACH_FEEDBACK_SCALE_LEGEND,
  coachFeedbackAverage,
  type CoachFeedback,
  type CoachFeedbackCommentKey,
} from '@/domain/coachFeedback';
import { formatFivePointChoice } from '@/domain/fivePointScale';
import { memberListName } from '@/domain/members';
import {
  CMO_SCALE_KEYS,
  CMO_SCALE_LABELS,
  cmoScaleAverage,
  displayMatchForCmoReport,
  type MatchReport,
} from '@/domain/reports';
import type { Match, UserProfile } from '@/domain/types';
import {
  cmoFilerName,
  cmoSubjectOfficialId,
} from '@/features/insights/insightsDisplay';
import { formatInsightsAvg } from '@/features/insights/insightsFormat';
import { InsightsReportTrailing } from '@/features/insights/InsightsReportTrailing';
import '@/features/referee/reports/reports.css';
import { backState, useAppBack, type BackNav } from '@/nav/backNav';
import { isFirebaseConfigured } from '@/services/firebase';
import {
  defaultOrgId,
  subscribeCoachFeedbackDoc,
  subscribeMatchReportDoc,
} from '@/services/orgData';
import { MatchListRow } from '@/ui/MatchListRow';
import { ScaleRatingCards } from '@/ui/ScaleRatingCards';

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

function commentText(
  feedback: CoachFeedback,
  key: CoachFeedbackCommentKey,
): string {
  return feedback[key]?.trim() ?? '';
}

function ScorePill({ value }: { value: string }) {
  return <span className="rs-pill">{value}</span>;
}


export function CmoPublicReportRow({
  report,
  matches,
  users,
  to,
  back,
}: {
  report: MatchReport;
  matches: Match[];
  users: UserProfile[];
  to: string;
  back?: BackNav;
}) {
  const memberBase = useAppHref('/about/members');
  const match = displayMatchForCmoReport(report, matches);
  const author = cmoFilerName(report, users);
  const scaleAvg = cmoScaleAverage(report.cmoPayload?.scales);
  const assessed = report.cmoPayload?.assessedRating;
  const trailing = (
    <InsightsReportTrailing
      score={formatInsightsAvg(scaleAvg)}
      scoreHint="Avg"
      secondaryScore={assessed != null ? String(assessed) : '—'}
      secondaryHint="Grade"
      officialName={author}
      officialHref={`${memberBase}/${report.officialId}`}
      namePrefix="CMO"
    />
  );

  if (match) {
    return (
      <MatchListRow
        match={match}
        to={to}
        back={back}
        split="action"
        showTime={report.source !== 'legacy_form'}
        trailing={trailing}
      />
    );
  }

  return (
    <div className="rs-list-row rs-list-row--action">
      <Link
        to={to}
        state={back ? backState(back) : undefined}
        className="rs-list-row__main"
      >
        <div className="rs-list-row__body">
          <span className="rs-match-card__title">CMO coaching report</span>
        </div>
      </Link>
      <div className="rs-list-row__trailing">{trailing}</div>
    </div>
  );
}

export function PublishedTeamFeedbackRow({
  feedback,
  matches,
  to,
  back,
}: {
  feedback: CoachFeedback;
  matches: Match[];
  to: string;
  back?: BackNav;
}) {
  const match = matches.find((m) => m.id === feedback.matchId);
  const avg = coachFeedbackAverage(feedback.scales);
  const meta = (
    <span className="rs-match-card__meta">{feedback.reportingTeamName}</span>
  );
  const trailing = (
    <ScorePill value={avg != null ? formatInsightsAvg(avg) : '—'} />
  );

  if (match) {
    return (
      <MatchListRow
        match={match}
        to={to}
        back={back}
        split="action"
        linkWholeCard
        meta={meta}
        trailing={trailing}
      />
    );
  }

  return (
    <div className="rs-list-row rs-list-row--action">
      <Link
        to={to}
        state={back ? backState(back) : undefined}
        className="rs-list-row__card-link"
      >
        <div className="rs-list-row__main">
          <div className="rs-list-row__body">
            <span className="rs-match-card__title">
              {feedback.homeTeamName} vs {feedback.awayTeamName}
            </span>
            {meta}
          </div>
        </div>
        <div className="rs-list-row__trailing">{trailing}</div>
      </Link>
    </div>
  );
}

export function CmoPublicReportView({
  report,
  matches,
  users,
}: {
  report: MatchReport;
  matches: Match[];
  users: UserProfile[];
}) {
  const match = displayMatchForCmoReport(report, matches);
  const p = report.cmoPayload;
  const author = cmoFilerName(report, users);

  return (
    <div className="rs-stack rs-report-view rs-member-public-report">
      <p className="rs-match-card__meta">
        Filed by {author} as CMO
        {report.submittedAt
          ? ` · ${new Date(report.submittedAt).toLocaleString()}`
          : ''}
      </p>
      {match ? (
        <MatchListRow match={match} showTime={report.source !== 'legacy_form'} />
      ) : (
        <p className="rs-match-card__meta">Match details not on file.</p>
      )}
      {p ? (
        <>
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
          <Field label="Keep">{p.keep}</Field>
          <Field label="Start">{p.start}</Field>
          <Field label="Stop">{p.stop}</Field>
          <Field label="Coach open comments">{p.overallComment}</Field>
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

export function PublishedTeamFeedbackView({
  feedback,
  matches,
}: {
  feedback: CoachFeedback;
  matches: Match[];
}) {
  const match = matches.find((m) => m.id === feedback.matchId);
  const avg = coachFeedbackAverage(feedback.scales);

  return (
    <div className="rs-stack rs-report-view rs-member-public-report">
      <p className="rs-match-card__meta">
        {feedback.reportingTeamName}
        {feedback.clubRole ? ` · ${feedback.clubRole}` : ''}
        {avg != null
          ? ` · Avg ${Number.isInteger(avg) ? avg : avg.toFixed(1)}`
          : ''}
      </p>
      {match ? (
        <MatchListRow match={match} />
      ) : (
        <p className="rs-match-card__meta">
          {feedback.homeTeamName} vs {feedback.awayTeamName}
          {feedback.score ? ` · ${feedback.score}` : ''}
        </p>
      )}
      <p className="rs-match-card__meta rs-coach-fb-scale-legend">
        {COACH_FEEDBACK_SCALE_LEGEND}
      </p>
      {COACH_FEEDBACK_SCALE_KEYS.map((key) => {
        const selected = feedback.scales[key];
        return (
          <div key={key} className="rs-coach-fb-criterion">
            <div className="rs-coach-fb-criterion__head">
              <span className="rs-coach-fb-criterion__title">
                {COACH_FEEDBACK_CRITERION_LABELS[key]}
              </span>
              <p className="rs-coach-fb-criterion__hint">
                {COACH_FEEDBACK_CRITERION_HINTS[key]}
              </p>
            </div>
            <ScaleRatingCards
              name={`pub-fb-${feedback.id}-${key}`}
              value={selected}
              ariaLabel={COACH_FEEDBACK_CRITERION_LABELS[key]}
              readOnly
            />
          </div>
        );
      })}
      {COACH_FEEDBACK_COMMENT_BLOCKS.map((block) => {
        const text = commentText(feedback, block.key);
        if (!text) return null;
        return (
          <Field key={block.key} label={block.label}>
            {text}
          </Field>
        );
      })}
      {feedback.videoLink ? (
        <Field label="Video link">
          <a href={feedback.videoLink} target="_blank" rel="noreferrer">
            {feedback.videoLink}
          </a>
        </Field>
      ) : null}
      <Field label="Video notes">{feedback.videoNotes}</Field>
    </div>
  );
}

function ReportNotFound({
  title,
  backLabel,
  onBack,
}: {
  title: string;
  backLabel: string;
  onBack: () => void;
}) {
  return (
    <div className="rs-stack">
      <Button variant="link" className="rs-detail__back" onClick={onBack}>
        ← {backLabel}
      </Button>
      <Title headingLevel="h1" size="lg">
        {title}
      </Title>
      <p className="rs-match-card__meta">That report is not available.</p>
    </div>
  );
}

export function MemberCmoReportPage() {
  const { userId = '', reportId = '' } = useParams();
  const { state, dataMode } = useApp();
  const profileHref = useAppHref(`/about/members/${userId}`);
  const fromStore = state.matchReports.find((r) => r.id === reportId) ?? null;
  const [fetched, setFetched] = useState<MatchReport | null>(null);
  const [loadingRemote, setLoadingRemote] = useState(
    () => !fromStore && dataMode === 'live' && isFirebaseConfigured,
  );

  useEffect(() => {
    if (fromStore || dataMode !== 'live' || !isFirebaseConfigured) {
      setFetched(null);
      setLoadingRemote(false);
      return;
    }
    setLoadingRemote(true);
    return subscribeMatchReportDoc(defaultOrgId(), reportId, (report) => {
      setFetched(report);
      setLoadingRemote(false);
    });
  }, [reportId, fromStore, dataMode]);

  const member = state.users.find((u) => u.uid === userId);
  const fallback = {
    to: `${profileHref}#cmo-reports`,
    label: member ? memberListName(member) : 'Profile',
  } satisfies BackNav;
  const { goBack: onBack, backLabel } = useAppBack(fallback);

  const report = fromStore ?? fetched;
  const match = report
    ? displayMatchForCmoReport(report, state.matches)
    : undefined;
  const aboutThisOfficial =
    report != null &&
    report.slot === 'cmo' &&
    report.status === 'submitted' &&
    cmoSubjectOfficialId(report, match) === userId;

  if (!fromStore && loadingRemote) {
    return <p className="rs-match-card__meta">Loading…</p>;
  }

  if (!report || !aboutThisOfficial) {
    return (
      <ReportNotFound
        title="CMO report not found"
        backLabel={backLabel}
        onBack={onBack}
      />
    );
  }

  return (
    <div className="rs-stack">
      <Button variant="link" className="rs-detail__back" onClick={onBack}>
        ← {backLabel}
      </Button>
      <Title headingLevel="h1" size="lg">
        CMO coaching report
      </Title>
      <CmoPublicReportView
        report={report}
        matches={state.matches}
        users={state.users}
      />
    </div>
  );
}

export function MemberTeamFeedbackPage() {
  const { userId = '', feedbackId = '' } = useParams();
  const { state, dataMode } = useApp();
  const profileHref = useAppHref(`/about/members/${userId}`);
  const fromStore = state.coachFeedback.find((f) => f.id === feedbackId) ?? null;
  const [fetched, setFetched] = useState<CoachFeedback | null>(null);
  const [loadingRemote, setLoadingRemote] = useState(
    () => !fromStore && dataMode === 'live' && isFirebaseConfigured,
  );

  useEffect(() => {
    if (fromStore || dataMode !== 'live' || !isFirebaseConfigured) {
      setFetched(null);
      setLoadingRemote(false);
      return;
    }
    setLoadingRemote(true);
    return subscribeCoachFeedbackDoc(defaultOrgId(), feedbackId, (feedback) => {
      setFetched(feedback);
      setLoadingRemote(false);
    });
  }, [feedbackId, fromStore, dataMode]);

  const member = state.users.find((u) => u.uid === userId);
  const fallback = {
    to: `${profileHref}#team-feedback`,
    label: member ? memberListName(member) : 'Profile',
  } satisfies BackNav;
  const { goBack: onBack, backLabel } = useAppBack(fallback);

  const feedback = fromStore ?? fetched;
  const isPublicForOfficial =
    feedback != null &&
    feedback.status === 'submitted' &&
    feedback.publicOnProfile === true &&
    feedback.officialUserId === userId;

  if (!fromStore && loadingRemote) {
    return <p className="rs-match-card__meta">Loading…</p>;
  }

  if (!feedback || !isPublicForOfficial) {
    return (
      <ReportNotFound
        title="Team feedback not found"
        backLabel={backLabel}
        onBack={onBack}
      />
    );
  }

  return (
    <div className="rs-stack">
      <Button variant="link" className="rs-detail__back" onClick={onBack}>
        ← {backLabel}
      </Button>
      <Title headingLevel="h1" size="lg">
        Team feedback
      </Title>
      <PublishedTeamFeedbackView
        feedback={feedback}
        matches={state.matches}
      />
    </div>
  );
}
