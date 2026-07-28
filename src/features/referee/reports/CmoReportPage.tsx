import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Button,
  Form,
  FormGroup,
  FormSelect,
  FormSelectOption,
  TextArea,
  Title,
} from '@patternfly/react-core';
import { useApp } from '@/app/AppContext';
import {
  CMO_SCALE_LABELS,
  type CmoReportPayload,
  type CmoScaleKey,
} from '@/domain/reports';
import { moDisplayNames } from '@/features/referee/appointments/crewLines';
import {
  pendingReportForUserOnMatch,
  cmoReportViewPath,
} from '@/features/referee/reports/reportLinks';

const SCALE_KEYS = Object.keys(CMO_SCALE_LABELS) as CmoScaleKey[];

export function CmoReportPage() {
  const { matchId = '' } = useParams();
  const { currentUser, state, store } = useApp();
  const navigate = useNavigate();

  const match = state.matches.find((m) => m.id === matchId);
  const report = useMemo(() => {
    if (!currentUser || !matchId) return undefined;
    const r = pendingReportForUserOnMatch(
      state.matchReports,
      matchId,
      currentUser.uid,
    );
    return r?.slot === 'cmo' ? r : undefined;
  }, [currentUser, matchId, state.matchReports]);

  const [scales, setScales] = useState<Partial<Record<CmoScaleKey, number>>>(
    {},
  );
  const [comments, setComments] = useState<
    Partial<Record<CmoScaleKey, string>>
  >({});
  const [overallComment, setOverallComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

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

  const submit = () => {
    const missing = SCALE_KEYS.filter((k) => scales[k] == null);
    if (missing.length > 0) {
      setError('Rate every scale from 1–5.');
      return;
    }
    const payload: CmoReportPayload = {
      scales,
      comments,
      overallComment: overallComment.trim() || undefined,
    };
    store.submitCmoReport(report.id, payload);
    setDone(true);
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
        {SCALE_KEYS.map((key) => (
          <div key={key}>
            <FormGroup
              label={CMO_SCALE_LABELS[key]}
              isRequired
              fieldId={`cmo-scale-${key}`}
            >
              <FormSelect
                id={`cmo-scale-${key}`}
                value={scales[key] != null ? String(scales[key]) : ''}
                onChange={(_e, v) =>
                  setScales((s) => ({
                    ...s,
                    [key]: v === '' ? undefined : Number(v),
                  }))
                }
                aria-label={CMO_SCALE_LABELS[key]}
              >
                <FormSelectOption value="" label="Select 1–5" />
                {[1, 2, 3, 4, 5].map((n) => (
                  <FormSelectOption
                    key={n}
                    value={String(n)}
                    label={String(n)}
                  />
                ))}
              </FormSelect>
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

        <FormGroup label="Overall comment" fieldId="cmo-overall">
          <TextArea
            id="cmo-overall"
            value={overallComment}
            onChange={(_e, v) => setOverallComment(v)}
            rows={3}
          />
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
