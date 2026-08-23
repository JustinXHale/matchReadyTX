import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Button,
  Form,
  FormGroup,
  TextArea,
  TextInput,
  Title,
} from '@patternfly/react-core';
import { useApp } from '@/app/AppContext';
import {
  CMO_ASSESSED_RATING_MAX,
  CMO_ASSESSED_RATING_MIN,
  CMO_SCALE_LABELS,
  parseAssessedRating,
  validateCmoScales,
  type CmoReportPayload,
  type CmoScaleKey,
} from '@/domain/reports';
import type { FivePointChoice } from '@/domain/fivePointScale';
import { moDisplayNames } from '@/features/referee/appointments/crewLines';
import {
  pendingReportForUserOnMatch,
  cmoReportViewPath,
} from '@/features/referee/reports/reportLinks';
import { RefereeLevelChart } from '@/ui/RefereeLevelChart';
import { ScaleRatingCards } from '@/ui/ScaleRatingCards';
import {
  ensureMatchReportReady,
  persistSubmittedCmoReport,
} from '@/services/reportsLive';

const SCALE_KEYS = Object.keys(CMO_SCALE_LABELS) as CmoScaleKey[];

export function CmoReportPage() {
  const { matchId = '' } = useParams();
  const { currentUser, state, store, dataMode } = useApp();
  const navigate = useNavigate();

  const match = state.matches.find((m) => m.id === matchId);
  const report = useMemo(() => {
    if (!currentUser || !matchId) return undefined;
    return pendingReportForUserOnMatch(
      state.matchReports,
      matchId,
      currentUser.uid,
      'cmo',
    );
  }, [currentUser, matchId, state.matchReports]);

  const [scales, setScales] = useState<
    Partial<Record<CmoScaleKey, FivePointChoice>>
  >({});
  const [comments, setComments] = useState<
    Partial<Record<CmoScaleKey, string>>
  >({});
  const [overallComment, setOverallComment] = useState('');
  const [assessedRating, setAssessedRating] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (dataMode !== 'live' || !currentUser || !matchId) return;
    void ensureMatchReportReady(matchId, currentUser.uid).catch((err) =>
      console.error('ensureMatchReportReady failed', err),
    );
  }, [dataMode, currentUser?.uid, matchId]);

  if (!currentUser) return null;

  if (!match) {
    return (
      <div className="rs-stack">
        <Title headingLevel="h2" size="lg">
          Match not found
        </Title>
        <Button
          variant="link"
          onClick={() => navigate('/referee/reports/coaching')}
        >
          Back to Coaching Reports
        </Button>
      </div>
    );
  }

  if (!report) {
    const submitted = state.matchReports.find(
      (r) =>
        r.matchId === matchId &&
        r.officialId === currentUser.uid &&
        r.slot === 'cmo' &&
        r.status === 'submitted',
    );
    return (
      <div className="rs-stack">
        <Title headingLevel="h2" size="lg">
          {submitted ? 'CMO report already submitted' : 'No CMO report due'}
        </Title>
        <p className="rs-match-card__meta">
          {match.homeTeamName} vs {match.awayTeamName}. Notices open at kickoff
          + 90 minutes; complete within 48 hours of kickoff.
        </p>
        {submitted && (
          <Button
            variant="primary"
            onClick={() => navigate(cmoReportViewPath(matchId))}
          >
            View report
          </Button>
        )}
        <Button
          variant="secondary"
          onClick={() => navigate('/referee/reports/coaching')}
        >
          Back to Coaching Reports
        </Button>
      </div>
    );
  }

  if (done) {
    return (
      <div className="rs-stack">
        <Title headingLevel="h2" size="lg">
          CMO report submitted
        </Title>
        <p className="rs-match-card__meta">
          {match.homeTeamName} vs {match.awayTeamName} is on file.
        </p>
        <Button
          variant="primary"
          onClick={() => navigate(cmoReportViewPath(matchId))}
        >
          View report
        </Button>
        <Button
          variant="secondary"
          onClick={() => navigate('/referee/reports/coaching')}
        >
          Back to Coaching Reports
        </Button>
      </div>
    );
  }

  const deadline = report.deadlineAt
    ? new Date(report.deadlineAt).toLocaleString()
    : null;

  const submit = async () => {
    if (!validateCmoScales(scales, SCALE_KEYS)) {
      setError('Rate every scale from 1–5, or N/A.');
      return;
    }
    const rating = parseAssessedRating(assessedRating);
    if (rating == null) {
      setError(
        `Enter an assessed rating from ${CMO_ASSESSED_RATING_MIN}–${CMO_ASSESSED_RATING_MAX} (${CMO_ASSESSED_RATING_MIN} highest, ${CMO_ASSESSED_RATING_MAX} lowest).`,
      );
      return;
    }
    const payload: CmoReportPayload = {
      scales,
      comments,
      overallComment: overallComment.trim() || undefined,
      assessedRating: rating,
    };
    try {
      if (dataMode === 'live') {
        await persistSubmittedCmoReport(report.id, payload, match.id);
      } else {
        store.submitCmoReport(report.id, payload);
      }
      setDone(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not save CMO report.',
      );
    }
  };

  return (
    <div className="rs-stack">
      <button
        type="button"
        className="rs-detail__back"
        onClick={() => navigate('/referee/reports/coaching')}
      >
        ← Coaching Reports
      </button>
      <Title headingLevel="h2" size="lg">
        CMO report
      </Title>
      <p className="rs-match-card__meta">
        {match.homeTeamName} vs {match.awayTeamName} · MO {moDisplayNames(match)}
      </p>
      {deadline && (
        <p className="rs-match-card__meta">
          Please complete within 48 hours of kickoff (by {deadline}).
        </p>
      )}

      <Form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <section className="rs-detail-card rs-coach-fb-ratings">
          <p className="rs-match-card__meta rs-coach-fb-scale-legend">
            1 Poor · 2 Below Average · 3 Average · 4 Above Average · 5 Excellent
            · N/A not applicable.
          </p>

          {SCALE_KEYS.map((key) => (
            <div key={key} className="rs-coach-fb-criterion">
              <FormGroup
                label={CMO_SCALE_LABELS[key]}
                isRequired
                fieldId={`cmo-scale-${key}-1`}
              >
                <ScaleRatingCards
                  name={`cmo-scale-${key}`}
                  value={scales[key]}
                  onChange={(v) =>
                    setScales((s) => ({
                      ...s,
                      [key]: v,
                    }))
                  }
                  ariaLabel={CMO_SCALE_LABELS[key]}
                />
              </FormGroup>
              <FormGroup
                label={`${CMO_SCALE_LABELS[key]} comment`}
                fieldId={`cmo-c-${key}`}
              >
                <TextArea
                  id={`cmo-c-${key}`}
                  value={comments[key] ?? ''}
                  onChange={(_e, v) =>
                    setComments((c) => ({ ...c, [key]: v }))
                  }
                  rows={2}
                />
              </FormGroup>
            </div>
          ))}
        </section>

        <FormGroup label="Overall comment" fieldId="cmo-overall">
          <TextArea
            id="cmo-overall"
            value={overallComment}
            onChange={(_e, v) => setOverallComment(v)}
            rows={3}
          />
        </FormGroup>

        <FormGroup
          label="What is your assessed rating?"
          isRequired
          fieldId="cmo-assessed-rating"
        >
          <RefereeLevelChart
            className="rs-profile-level-chart"
            caption="Match this official to a column (1 highest, 10 lowest). Tap the chart to enlarge."
          />
          <TextInput
            id="cmo-assessed-rating"
            type="number"
            inputMode="numeric"
            min={CMO_ASSESSED_RATING_MIN}
            max={CMO_ASSESSED_RATING_MAX}
            step={1}
            value={assessedRating}
            onChange={(_e, v) => setAssessedRating(v)}
            placeholder={`e.g. 8 (${CMO_ASSESSED_RATING_MIN} highest, ${CMO_ASSESSED_RATING_MAX} lowest)`}
            aria-label="Assessed rating"
          />
          <p className="rs-match-card__meta">
            Whole number {CMO_ASSESSED_RATING_MIN}–{CMO_ASSESSED_RATING_MAX}.{' '}
            {CMO_ASSESSED_RATING_MIN} is the highest grade;{' '}
            {CMO_ASSESSED_RATING_MAX} is the lowest.
          </p>
        </FormGroup>

        {error && (
          <p className="rs-match-card__meta" role="alert">
            {error}
          </p>
        )}

        <Button type="submit" variant="primary" isBlock>
          Submit CMO report
        </Button>
      </Form>
    </div>
  );
}
