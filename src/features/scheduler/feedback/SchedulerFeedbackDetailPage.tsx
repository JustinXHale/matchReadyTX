import { Button, Title } from '@patternfly/react-core';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp, useAppHref } from '@/app/AppContext';
import {
  COACH_FEEDBACK_CRITERION_LABELS,
  COACH_FEEDBACK_SCALE_KEYS,
  COACH_FEEDBACK_SCALE_LABELS,
} from '@/domain/coachFeedback';

export function SchedulerFeedbackDetailPage() {
  const { feedbackId = '' } = useParams();
  const { state, hasAssignerRole } = useApp();
  const navigate = useNavigate();
  const listHref = useAppHref('/scheduler/feedback');

  const feedback = state.coachFeedback.find((f) => f.id === feedbackId);

  if (!hasAssignerRole) {
    return (
      <p className="rs-match-card__meta">
        Scheduler tools require an assigner role.
      </p>
    );
  }

  if (!feedback) {
    return (
      <div className="rs-stack">
        <Title headingLevel="h2" size="lg">
          Feedback not found
        </Title>
        <Button variant="link" onClick={() => navigate(listHref)}>
          Back to Feedback
        </Button>
      </div>
    );
  }

  const kickoff = new Date(feedback.kickoffAt).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
  const submitted = new Date(feedback.createdAt).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <div className="rs-stack">
      <Button variant="link" isInline onClick={() => navigate(listHref)}>
        ← Feedback
      </Button>
      <Title headingLevel="h1">Coach feedback</Title>
      <p className="rs-match-card__meta">
        {feedback.homeTeamName} vs {feedback.awayTeamName} · {kickoff}
        <br />
        Match Official: {feedback.officialName}
        {feedback.score ? ` · Score ${feedback.score}` : ''}
        {feedback.level ? ` · ${feedback.level}` : ''}
        {feedback.competition ? ` · ${feedback.competition}` : ''}
      </p>

      <section className="rs-detail-card" aria-labelledby="cf-scales">
        <h2 id="cf-scales" className="rs-detail-section__label">
          Performance scores
        </h2>
        <ul className="rs-stack">
          {COACH_FEEDBACK_SCALE_KEYS.map((key) => (
            <li key={key} className="rs-match-card__meta">
              <strong>{COACH_FEEDBACK_CRITERION_LABELS[key]}:</strong>{' '}
              {COACH_FEEDBACK_SCALE_LABELS[feedback.scales[key]]}
            </li>
          ))}
        </ul>
      </section>

      {(feedback.commentsOnScores ||
        feedback.areasDoneWell ||
        feedback.areasToImprove ||
        feedback.otherFeedback ||
        feedback.otherCrewFeedback) && (
        <section className="rs-detail-card" aria-labelledby="cf-notes">
          <h2 id="cf-notes" className="rs-detail-section__label">
            Comments
          </h2>
          {feedback.commentsOnScores && (
            <p>
              <strong>On scores:</strong> {feedback.commentsOnScores}
            </p>
          )}
          {feedback.areasDoneWell && (
            <p>
              <strong>Refereed well:</strong> {feedback.areasDoneWell}
            </p>
          )}
          {feedback.areasToImprove && (
            <p>
              <strong>Improve:</strong> {feedback.areasToImprove}
            </p>
          )}
          {feedback.otherFeedback && (
            <p>
              <strong>Other:</strong> {feedback.otherFeedback}
            </p>
          )}
          {feedback.otherCrewFeedback && (
            <p>
              <strong>Other crew:</strong> {feedback.otherCrewFeedback}
            </p>
          )}
        </section>
      )}

      {(feedback.videoLink || feedback.videoNotes) && (
        <section className="rs-detail-card" aria-labelledby="cf-video">
          <h2 id="cf-video" className="rs-detail-section__label">
            Video
          </h2>
          {feedback.videoLink && (
            <p>
              <a href={feedback.videoLink} target="_blank" rel="noreferrer">
                {feedback.videoLink}
              </a>
            </p>
          )}
          {feedback.videoNotes && <p>{feedback.videoNotes}</p>}
        </section>
      )}

      <section className="rs-detail-card" aria-labelledby="cf-contact">
        <h2 id="cf-contact" className="rs-detail-section__label">
          Submitted by
        </h2>
        <p className="rs-match-card__meta">
          {feedback.submitterName} · {feedback.clubRole} ·{' '}
          {feedback.reportingTeamName}
          <br />
          {feedback.submitterEmail}
          {feedback.submitterPhone ? ` · ${feedback.submitterPhone}` : ''}
          <br />
          Submitted {submitted}
        </p>
      </section>
    </div>
  );
}
