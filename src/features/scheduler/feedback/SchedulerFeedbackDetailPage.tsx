import { Button, FormGroup, Switch, TextInput, TextArea, Title } from '@patternfly/react-core';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useMemo, useState } from 'react';
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
import { isFirebaseConfigured } from '@/services/firebase';
import {
  defaultOrgId,
  setCoachFeedbackPublicOnProfile,
} from '@/services/orgData';
import { useAppBack, type BackNav } from '@/nav/backNav';
import { MatchListRow } from '@/ui/MatchListRow';
import { ScaleRatingCards } from '@/ui/ScaleRatingCards';

function commentText(
  feedback: CoachFeedback,
  key: CoachFeedbackCommentKey,
): string {
  return feedback[key]?.trim() ?? '';
}

function ReadOnlyYesNo({
  id,
  label,
  yes,
}: {
  id: string;
  label: string;
  yes: boolean;
}) {
  return (
    <div
      className="rs-coach-fb-toggle"
      role="group"
      aria-labelledby={`${id}-label`}
    >
      <div className="rs-coach-fb-toggle__label" id={`${id}-label`}>
        {label}
      </div>
      <div className="rs-coach-fb-toggle__btns">
        <span
          className={`rs-filter-chip${yes ? ' rs-filter-chip--selected' : ''}`}
          aria-current={yes ? 'true' : undefined}
        >
          Yes
        </span>
        <span
          className={`rs-filter-chip${!yes ? ' rs-filter-chip--selected' : ''}`}
          aria-current={!yes ? 'true' : undefined}
        >
          No
        </span>
      </div>
    </div>
  );
}

export function SchedulerFeedbackDetailPage() {
  const { feedbackId = '' } = useParams();
  const location = useLocation();
  const {
    state,
    hasInsightsAccess,
    hasAssignerRole,
    isAssignerView,
    dataMode,
    store,
  } = useApp();
  const insightsList = useAppHref('/insights/reports/coach-feedback');
  const schedulerList = useAppHref('/scheduler/feedback');
  const listHref = location.pathname.includes('/insights')
    ? insightsList
    : schedulerList;
  const listFallback = useMemo(
    (): BackNav => ({
      to: listHref,
      label: location.pathname.includes('/insights')
        ? 'Coach feedback'
        : 'Feedback',
    }),
    [listHref, location.pathname],
  );
  const { goBack, backLabel } = useAppBack(listFallback);
  const memberBase = useAppHref('/about/members');
  const [publishBusy, setPublishBusy] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  const feedback = state.coachFeedback.find((f) => f.id === feedbackId);
  const match = feedback
    ? state.matches.find((m) => m.id === feedback.matchId)
    : undefined;

  if (!hasInsightsAccess) {
    return (
      <p className="rs-match-card__meta">
        You do not have access to view coach feedback reports.
      </p>
    );
  }

  if (!feedback || feedback.status !== 'submitted') {
    return (
      <div className="rs-stack">
        <Title headingLevel="h2" size="lg">
          Feedback not found
        </Title>
        <Button variant="link" onClick={goBack}>
          ← {backLabel}
        </Button>
      </div>
    );
  }

  const submitted = new Date(
    feedback.submittedAt ?? feedback.createdAt,
  ).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
  const updated = new Date(feedback.updatedAt).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
  const avg = coachFeedbackAverage(feedback.scales);
  const officialHref = feedback.officialUserId
    ? `${memberBase}/${feedback.officialUserId}`
    : null;
  const canPublish = isAssignerView && hasAssignerRole;
  const onProfile = feedback.publicOnProfile === true;

  const setPublished = async (next: boolean) => {
    setPublishBusy(true);
    setPublishError(null);
    try {
      if (dataMode === 'live' && isFirebaseConfigured) {
        await setCoachFeedbackPublicOnProfile(
          defaultOrgId(),
          feedback.id,
          next,
        );
      } else {
        store.setCoachFeedbackPublicOnProfile(feedback.id, next);
      }
      store.upsertCoachFeedbackLocal({
        ...feedback,
        publicOnProfile: next,
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      setPublishError(
        err instanceof Error ? err.message : 'Could not update visibility.',
      );
    } finally {
      setPublishBusy(false);
    }
  };

  return (
    <div className="rs-stack">
      <Button
        variant="link"
        className="rs-detail__back"
        onClick={goBack}
      >
        ← {backLabel}
      </Button>
      <Title headingLevel="h1" size="lg">
        Coach feedback
      </Title>
      <p className="rs-match-card__meta">
        Match Official:{' '}
        {officialHref ? (
          <Link to={officialHref}>{feedback.officialName}</Link>
        ) : (
          feedback.officialName
        )}{' '}
        · Reporting as {feedback.reportingTeamName}
        {avg != null ? ` · Avg ${Number.isInteger(avg) ? avg : avg.toFixed(1)}` : ''}
      </p>

      {canPublish && (
        <div className="rs-detail-card">
          <Switch
            id="scf-public-profile"
            label="Show on profile"
            isChecked={onProfile}
            isDisabled={publishBusy}
            onChange={(_e, checked) => {
              void setPublished(checked);
            }}
          />
          <p className="rs-match-card__meta pf-v6-u-mt-sm">
            Hidden by default. Publishing lets any society member read this
            report on the official’s profile, without the submitter’s phone or
            email.
          </p>
          {publishError ? (
            <p className="rs-match-card__meta" role="alert">
              {publishError}
            </p>
          ) : null}
        </div>
      )}

      {match ? (
        <MatchListRow match={match} />
      ) : (
        <p className="rs-match-card__meta">
          {feedback.homeTeamName} vs {feedback.awayTeamName}
          {feedback.score ? ` · ${feedback.score}` : ''}
        </p>
      )}

      <div className="rs-form-stack">
        <div className="rs-form-row rs-form-row--2">
          <FormGroup label="Name" fieldId="scf-name">
            <TextInput
              id="scf-name"
              value={feedback.submitterName}
              isDisabled
            />
          </FormGroup>
          <FormGroup label="Role" fieldId="scf-role">
            <TextInput id="scf-role" value={feedback.clubRole} isDisabled />
          </FormGroup>
        </div>
        <div className="rs-form-row rs-form-row--2">
          <FormGroup label="Phone" fieldId="scf-phone">
            <TextInput
              id="scf-phone"
              value={feedback.submitterPhone ?? ''}
              isDisabled
            />
          </FormGroup>
          <FormGroup label="Email" fieldId="scf-email">
            <TextInput
              id="scf-email"
              value={feedback.submitterEmail}
              isDisabled
            />
          </FormGroup>
        </div>

        <ReadOnlyYesNo
          id="scf-contact-about"
          label="Would you like to be contacted about this report?"
          yes={feedback.contactAboutReport === true}
        />

        <FormGroup label="Video link" fieldId="scf-video">
          {feedback.videoLink ? (
            <p>
              <a href={feedback.videoLink} target="_blank" rel="noreferrer">
                {feedback.videoLink}
              </a>
            </p>
          ) : (
            <p className="rs-match-card__meta">None provided</p>
          )}
        </FormGroup>

        <section
          className="rs-detail-card rs-coach-fb-ratings"
          aria-labelledby="scf-ratings"
        >
          <h2 id="scf-ratings" className="rs-detail-section__label">
            Performance ratings
          </h2>
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
                  name={`scf-scale-${key}`}
                  value={selected}
                  ariaLabel={COACH_FEEDBACK_CRITERION_LABELS[key]}
                  readOnly
                />
              </div>
            );
          })}
        </section>

        {COACH_FEEDBACK_COMMENT_BLOCKS.map((block) => {
          const text = commentText(feedback, block.key);
          const yes = Boolean(text);
          return (
            <div key={block.key} className="rs-coach-fb-comment-block">
              <ReadOnlyYesNo id={`scf-${block.key}`} label={block.label} yes={yes} />
              {yes && (
                <TextArea
                  id={`scf-text-${block.key}`}
                  value={text}
                  isDisabled
                  rows={3}
                  aria-label={block.label}
                />
              )}
            </div>
          );
        })}

        <p className="rs-match-card__meta">
          First submitted {submitted}
          {feedback.updatedAt !== (feedback.submittedAt ?? feedback.createdAt)
            ? ` · Last updated ${updated}`
            : ''}
          {feedback.edits.length > 1
            ? ` · ${feedback.edits.length} edits`
            : ''}
        </p>

        {feedback.edits.length > 0 && (
          <ul className="rs-stack">
            {feedback.edits.map((e, i) => (
              <li key={`${e.at}-${i}`} className="rs-match-card__meta">
                {e.action} · {e.byName} ·{' '}
                {new Date(e.at).toLocaleString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
