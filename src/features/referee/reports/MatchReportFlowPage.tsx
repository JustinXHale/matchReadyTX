import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Button,
  Checkbox,
  Form,
  FormGroup,
  Radio,
  TextArea,
  TextInput,
  Title,
} from '@patternfly/react-core';
import { useApp } from '@/app/AppContext';
import {
  crewForAttendance,
  isQuickReportLocked,
  matchHasAssignedCmo,
  totalCardsFromMoPayload,
  type ArReportPayload,
  type CrewAttendanceEntry,
  type MoReportPayload,
  type ReportFormKind,
} from '@/domain/reports';
import { backState } from '@/nav/backNav';
import {
  cardReportPath,
  MATCH_REPORTS_BACK,
  pendingCrewReportForUserOnMatch,
  reportHrefForSubmitted,
} from '@/features/referee/reports/reportLinks';
import { PerformanceReportForm } from '@/features/referee/reports/PerformanceReportForm';
import {
  CrewAttendanceFields,
  formatCrewAttendanceNote,
} from '@/features/referee/reports/CrewAttendanceFields';
import { MatchListRow } from '@/ui/MatchListRow';

type Step = 'chooser' | 'form' | 'done';

export function MatchReportFlowPage() {
  const { matchId = '' } = useParams();
  const { currentUser, state, store } = useApp();
  const navigate = useNavigate();

  const match = state.matches.find((m) => m.id === matchId);
  const report = useMemo(() => {
    if (!currentUser || !matchId) return undefined;
    return pendingCrewReportForUserOnMatch(
      state.matchReports,
      matchId,
      currentUser.uid,
    );
  }, [currentUser, matchId, state.matchReports]);

  const submitted = useMemo(() => {
    if (!currentUser || !matchId) return undefined;
    return state.matchReports.find(
      (r) =>
        r.matchId === matchId &&
        r.officialId === currentUser.uid &&
        r.slot !== 'cmo' &&
        r.status === 'submitted',
    );
  }, [currentUser, matchId, state.matchReports]);

  const initialKind: ReportFormKind | null =
    report?.formKind === 'mo_performance' ||
    report?.formKind === 'mo_quick' ||
    report?.formKind === 'ar_basic'
      ? report.formKind
      : report?.slot === 'ar1' || report?.slot === 'ar2'
        ? 'ar_basic'
        : null;

  const [step, setStep] = useState<Step>(() =>
    report?.slot === 'mo'
      ? 'chooser'
      : initialKind
        ? 'form'
        : report?.slot === 'ar1' || report?.slot === 'ar2'
          ? 'form'
          : 'chooser',
  );
  const [formKind, setFormKind] = useState<ReportFormKind | null>(() =>
    report?.slot === 'mo' ? null : initialKind,
  );
  const [cmoDidNotAttend, setCmoDidNotAttend] = useState(false);
  const [doneCards, setDoneCards] = useState(0);

  const [homePoints, setHomePoints] = useState('');
  const [awayPoints, setAwayPoints] = useState('');
  const [homeYellow, setHomeYellow] = useState('0');
  const [homeRed, setHomeRed] = useState('0');
  const [awayYellow, setAwayYellow] = useState('0');
  const [awayRed, setAwayRed] = useState('0');
  const [lightFeedback, setLightFeedback] = useState('');
  const [crewAttendance, setCrewAttendance] = useState<CrewAttendanceEntry[]>(
    () => (match ? crewForAttendance(match) : []),
  );
  const [crewAbsenceNote, setCrewAbsenceNote] = useState('');
  const [crewIssuesNote, setCrewIssuesNote] = useState('');
  const [stillComfortable, setStillComfortable] = useState<
    ArReportPayload['stillComfortable']
  >('');
  const [arIncidents, setArIncidents] = useState('');
  const [arNote, setArNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!currentUser) return null;

  if (!match) {
    return (
      <div className="rs-stack">
        <Title headingLevel="h2" size="lg">
          Match not found
        </Title>
        <Button
          variant="link"
          onClick={() => navigate('/referee/reports/match')}
        >
          Back to Match Reports
        </Button>
      </div>
    );
  }

  if (!report && submitted) {
    return (
      <div className="rs-stack">
        <Title headingLevel="h2" size="lg">
          Report already submitted
        </Title>
        <p className="rs-match-card__meta">
          {match.homeTeamName} vs {match.awayTeamName}
        </p>
        <Button
          variant="primary"
          onClick={() =>
            navigate(reportHrefForSubmitted(submitted), {
              state: backState(MATCH_REPORTS_BACK),
            })
          }
        >
          View report
        </Button>
        {submitted.slot === 'mo' && (
          <Button
            variant="secondary"
            onClick={() =>
              navigate(cardReportPath(match.id), {
                state: backState(MATCH_REPORTS_BACK),
              })
            }
          >
            Card report
          </Button>
        )}
        <Button
          variant="link"
          onClick={() => navigate('/referee/reports/match')}
        >
          Back to Match Reports
        </Button>
      </div>
    );
  }

  if (!report || report.slot === 'cmo') {
    return (
      <div className="rs-stack">
        <Title headingLevel="h2" size="lg">
          No match report due
        </Title>
        <p className="rs-match-card__meta">
          Open after kickoff + 90 minutes when you are MO, AR1, or AR2 on the
          crew. No.4 does not file a match report.
        </p>
        <Button
          variant="secondary"
          onClick={() => navigate('/referee/reports/match')}
        >
          Back to Match Reports
        </Button>
      </div>
    );
  }

  const hasCmo = matchHasAssignedCmo(match);
  const quickLocked = isQuickReportLocked(match, cmoDidNotAttend);

  const choose = (kind: 'mo_quick' | 'mo_performance') => {
    if (kind === 'mo_quick' && quickLocked) return;
    setFormKind(kind);
    setStep('form');
    setError(null);
  };

  const submitMoPayload = (payload: MoReportPayload, kind: ReportFormKind) => {
    if (!report) return;
    store.submitMatchReport(report.id, kind, payload);
    const { yellow, red } = totalCardsFromMoPayload(payload);
    const total = yellow + red;
    setDoneCards(total);
    if (total > 0) {
      navigate(cardReportPath(match.id), {
        state: backState(MATCH_REPORTS_BACK),
        replace: true,
      });
      return;
    }
    setStep('done');
  };

  const submit = () => {
    if (!formKind || !report) return;
    setError(null);

    if (formKind === 'ar_basic') {
      if (!stillComfortable) {
        setError(
          'Please answer whether you still feel comfortable at this level.',
        );
        return;
      }
      store.submitMatchReport(report.id, 'ar_basic', {
        stillComfortable,
        keyIncidents: arIncidents.trim() || undefined,
        note: arNote.trim() || undefined,
      });
      setStep('done');
      setDoneCards(0);
      return;
    }

    if (formKind === 'mo_quick' && quickLocked) {
      setError('Confirm that the CMO did not attend to use Quick Report.');
      return;
    }

    const home = Number(homePoints);
    const away = Number(awayPoints);
    const hy = Number(homeYellow);
    const hr = Number(homeRed);
    const ay = Number(awayYellow);
    const ar = Number(awayRed);
    if (!Number.isFinite(home) || !Number.isFinite(away)) {
      setError('Enter home and away points.');
      return;
    }
    if ([hy, hr, ay, ar].some((n) => !Number.isFinite(n) || n < 0)) {
      setError('Card counts must be zero or greater.');
      return;
    }
    const someoneAbsent = crewAttendance.some((c) => !c.attended);
    if (someoneAbsent && !crewAbsenceNote.trim()) {
      setError('Note who did not attend (and anything we should know).');
      return;
    }

    submitMoPayload(
      {
        homePoints: home,
        awayPoints: away,
        homeYellowCards: hy,
        homeRedCards: hr,
        awayYellowCards: ay,
        awayRedCards: ar,
        yellowCards: hy + ay,
        redCards: hr + ar,
        lightFeedback: lightFeedback.trim() || undefined,
        crewAttendance,
        crewAbsenceNote: someoneAbsent
          ? crewAbsenceNote.trim() || undefined
          : undefined,
        crewIssuesNote: crewIssuesNote.trim() || undefined,
        refereeTeamNote: formatCrewAttendanceNote(crewAttendance) || undefined,
        cmoDidNotAttend: hasCmo && formKind === 'mo_quick' ? true : undefined,
      },
      'mo_quick',
    );
  };

  if (step === 'done') {
    return (
      <div className="rs-stack">
        <Title headingLevel="h2" size="lg">
          Report submitted
        </Title>
        <p className="rs-match-card__meta">
          Thanks — {match.homeTeamName} vs {match.awayTeamName} is on file.
        </p>
        {doneCards > 0 ? (
          <>
            <p className="rs-match-card__meta">
              You noted cards on this match. A card report is required next.
            </p>
            <Button
              variant="primary"
              isBlock
              onClick={() =>
                navigate(cardReportPath(match.id), {
                  state: backState(MATCH_REPORTS_BACK),
                })
              }
            >
              File required card report
            </Button>
          </>
        ) : (
          <Button
            variant="secondary"
            onClick={() => navigate('/referee/reports/match')}
          >
            Back to Match Reports
          </Button>
        )}
      </div>
    );
  }

  if (step === 'chooser' || (report.slot === 'mo' && !formKind)) {
    const cmoName = (match.cmo ?? [])
      .map((c) => c.userName)
      .filter(Boolean)
      .join(', ');
    return (
      <div className="rs-stack">
        <button
          type="button"
          className="rs-detail__back"
          onClick={() => navigate('/referee/reports/match')}
        >
          ← Match Reports
        </button>
        <Title headingLevel="h2" size="lg">
          Match report
        </Title>
        <MatchListRow match={match} showTime hideScore />
        <p className="rs-match-card__meta">
          Choose a report type. Performance is always available.
        </p>
        <div className="rs-report-chooser__actions">
          <Button
            variant="primary"
            className="rs-report-chooser__half rs-btn--gold"
            onClick={() => choose('mo_performance')}
          >
            Performance Report
          </Button>
          <Button
            variant="secondary"
            className={`rs-report-chooser__half${
              quickLocked ? ' rs-btn--disabled-visible' : ''
            }`}
            isDisabled={quickLocked}
            onClick={() => choose('mo_quick')}
          >
            Quick Report
          </Button>
        </div>
        {hasCmo && (
          <Checkbox
            id="cmo-did-not-attend"
            label="CMO did not attend"
            description={
              cmoName
                ? `${cmoName} is assigned. Check if they did not show — unlocks Quick Report.`
                : 'Check if the assigned CMO did not show — unlocks Quick Report.'
            }
            isChecked={cmoDidNotAttend}
            onChange={(_e, checked) => setCmoDidNotAttend(checked)}
          />
        )}
        <Button
          variant="link"
          isBlock
          onClick={() =>
            navigate(cardReportPath(match.id), {
              state: backState(MATCH_REPORTS_BACK),
            })
          }
        >
          File card report first
        </Button>
      </div>
    );
  }

  if (formKind === 'mo_performance') {
    return (
      <PerformanceReportForm
        match={match}
        user={currentUser}
        cmoDidNotAttend={cmoDidNotAttend}
        onBack={() => {
          setFormKind(null);
          setStep('chooser');
        }}
        onSubmit={(payload) => submitMoPayload(payload, 'mo_performance')}
      />
    );
  }

  const kind = formKind ?? 'ar_basic';
  const title = kind === 'mo_quick' ? 'Quick Report' : 'AR Report';

  return (
    <div className="rs-stack">
      <button
        type="button"
        className="rs-detail__back"
        onClick={() => {
          if (report.slot === 'mo') {
            setFormKind(null);
            setStep('chooser');
          } else {
            navigate('/referee/reports/match');
          }
        }}
      >
        ← {report.slot === 'mo' ? 'Choose form' : 'Match Reports'}
      </button>
      <Title headingLevel="h2" size="lg">
        {title}
      </Title>
      <MatchListRow match={match} showTime hideScore />
      {hasCmo && kind === 'mo_quick' && cmoDidNotAttend && (
        <p className="rs-match-card__meta">
          Filing Quick Report because the assigned CMO did not attend.
        </p>
      )}

      <Form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        {kind === 'mo_quick' && (
          <>
            <div className="rs-team-score-card">
              <div className="rs-team-score-card__head">
                <span className="rs-pill rs-pill--ink">Home</span>
                <strong>{match.homeTeamName}</strong>
              </div>
              <div className="rs-form-grid-3">
                <FormGroup label="Points" isRequired fieldId="mo-home">
                  <TextInput
                    id="mo-home"
                    type="number"
                    value={homePoints}
                    onChange={(_e, v) => setHomePoints(v)}
                  />
                </FormGroup>
                <FormGroup label="YC" isRequired fieldId="mo-hy">
                  <TextInput
                    id="mo-hy"
                    type="number"
                    min={0}
                    value={homeYellow}
                    onChange={(_e, v) => setHomeYellow(v)}
                  />
                </FormGroup>
                <FormGroup label="RC" isRequired fieldId="mo-hr">
                  <TextInput
                    id="mo-hr"
                    type="number"
                    min={0}
                    value={homeRed}
                    onChange={(_e, v) => setHomeRed(v)}
                  />
                </FormGroup>
              </div>
            </div>
            <div className="rs-team-score-card">
              <div className="rs-team-score-card__head">
                <span className="rs-pill rs-pill--ink">Away</span>
                <strong>{match.awayTeamName}</strong>
              </div>
              <div className="rs-form-grid-3">
                <FormGroup label="Points" isRequired fieldId="mo-away">
                  <TextInput
                    id="mo-away"
                    type="number"
                    value={awayPoints}
                    onChange={(_e, v) => setAwayPoints(v)}
                  />
                </FormGroup>
                <FormGroup label="YC" isRequired fieldId="mo-ay">
                  <TextInput
                    id="mo-ay"
                    type="number"
                    min={0}
                    value={awayYellow}
                    onChange={(_e, v) => setAwayYellow(v)}
                  />
                </FormGroup>
                <FormGroup label="RC" isRequired fieldId="mo-ar">
                  <TextInput
                    id="mo-ar"
                    type="number"
                    min={0}
                    value={awayRed}
                    onChange={(_e, v) => setAwayRed(v)}
                  />
                </FormGroup>
              </div>
            </div>
            <CrewAttendanceFields
              crewAttendance={crewAttendance}
              onAttendanceChange={setCrewAttendance}
              crewAbsenceNote={crewAbsenceNote}
              onAbsenceNoteChange={setCrewAbsenceNote}
              crewIssuesNote={crewIssuesNote}
              onIssuesNoteChange={setCrewIssuesNote}
              idPrefix="quick-attend"
            />
            <FormGroup label="Light feedback" fieldId="mo-light">
              <TextArea
                id="mo-light"
                value={lightFeedback}
                onChange={(_e, v) => setLightFeedback(v)}
                rows={3}
              />
            </FormGroup>
          </>
        )}

        {kind === 'ar_basic' && (
          <>
            <FormGroup
              label="Still comfortable officiating at this level?"
              isRequired
            >
              <Radio
                id="ar-yes"
                name="ar-comfort"
                label="Yes"
                isChecked={stillComfortable === 'yes'}
                onChange={() => setStillComfortable('yes')}
              />
              <Radio
                id="ar-no"
                name="ar-comfort"
                label="No"
                isChecked={stillComfortable === 'no'}
                onChange={() => setStillComfortable('no')}
              />
            </FormGroup>
            <FormGroup label="Key incidents" fieldId="ar-inc">
              <TextArea
                id="ar-inc"
                value={arIncidents}
                onChange={(_e, v) => setArIncidents(v)}
                rows={3}
              />
            </FormGroup>
            <FormGroup label="Note" fieldId="ar-note">
              <TextArea
                id="ar-note"
                value={arNote}
                onChange={(_e, v) => setArNote(v)}
                rows={2}
              />
            </FormGroup>
          </>
        )}

        {error && (
          <p className="rs-match-card__meta" role="alert">
            {error}
          </p>
        )}

        <Button type="submit" variant="primary" isBlock>
          Submit report
        </Button>
      </Form>
    </div>
  );
}
