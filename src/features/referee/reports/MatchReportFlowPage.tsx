import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Button,
  Checkbox,
  Form,
  FormGroup,
  Radio,
  TextArea,
  Title,
} from '@patternfly/react-core';
import { useApp } from '@/app/AppContext';
import {
  AR_COMFORT_QUESTION,
  attendanceForReportForm,
  isQuickReportLocked,
  matchHasAssignedCmo,
  MATCH_FEEDBACK_LABEL,
  pendingCrewReportForAssignee,
  submittedCrewReportForAssignee,
  totalCardsFromMoPayload,
  type ArReportPayload,
  type CrewAttendanceEntry,
  type CrewReportSlot,
  type MoReportPayload,
  type ReportFormKind,
} from '@/domain/reports';
import { backState, useAppBack, type BackNav } from '@/nav/backNav';
import { isTournamentMatch } from '@/domain/matchScheduleUrl';
import {
  cardReportPath,
  MATCH_REPORTS_BACK,
  matchReportEditPath,
  pendingCrewReportForUserOnMatch,
  reportHrefForSubmitted,
} from '@/features/referee/reports/reportLinks';
import { PerformanceReportForm } from '@/features/referee/reports/PerformanceReportForm';
import {
  CrewAttendanceFields,
  formatCrewAttendanceNote,
} from '@/features/referee/reports/CrewAttendanceFields';
import {
  TeamScoreCard,
  TournamentMatchCheckbox,
  tournamentMoScorePayload,
} from '@/features/referee/reports/TeamScoreFields';
import {
  persistSubmittedMatchReport,
  ensureMatchReportReady,
  ensureMatchReportReadyForAssignee,
} from '@/services/reportsLive';
import type { UserProfile } from '@/domain/types';
import { MatchListRow } from '@/ui/MatchListRow';

type Step = 'chooser' | 'form' | 'done';

export type AssignerFilingContext = {
  officialId: string;
  slot: CrewReportSlot;
  officialName: string;
  back: BackNav;
};

function crewFormKind(
  formKind: ReportFormKind | undefined,
  slot: string | undefined,
): ReportFormKind | null {
  if (
    formKind === 'mo_performance' ||
    formKind === 'mo_quick' ||
    formKind === 'ar_basic'
  ) {
    return formKind;
  }
  if (slot === 'ar1' || slot === 'ar2') return 'ar_basic';
  return null;
}

export function MatchReportFlowPage({
  assignerFiling,
}: {
  assignerFiling?: AssignerFilingContext;
} = {}) {
  const { matchId = '' } = useParams();
  const [searchParams] = useSearchParams();
  const { currentUser, state, store, dataMode } = useApp();
  const navigate = useNavigate();
  const isAssignerFiling = Boolean(assignerFiling);
  const filingUserId = assignerFiling?.officialId ?? currentUser?.uid ?? '';
  const flowBack = assignerFiling?.back ?? MATCH_REPORTS_BACK;
  const { goBack: exitFlow, backLabel: flowBackLabel } = useAppBack(flowBack);

  const match = state.matches.find((m) => m.id === matchId);
  const pending = useMemo(() => {
    if (!filingUserId || !matchId) return undefined;
    if (assignerFiling) {
      return pendingCrewReportForAssignee(
        state.matchReports,
        matchId,
        assignerFiling.officialId,
        assignerFiling.slot,
      );
    }
    return pendingCrewReportForUserOnMatch(
      state.matchReports,
      matchId,
      filingUserId,
    );
  }, [assignerFiling, filingUserId, matchId, state.matchReports]);

  const submitted = useMemo(() => {
    if (!filingUserId || !matchId) return undefined;
    if (assignerFiling) {
      return submittedCrewReportForAssignee(
        state.matchReports,
        matchId,
        assignerFiling.officialId,
        assignerFiling.slot,
      );
    }
    return state.matchReports.find(
      (r) =>
        r.matchId === matchId &&
        r.officialId === filingUserId &&
        r.slot !== 'cmo' &&
        r.status === 'submitted',
    );
  }, [assignerFiling, filingUserId, matchId, state.matchReports]);

  const isEditing =
    !isAssignerFiling &&
    searchParams.get('edit') === '1' &&
    Boolean(submitted) &&
    !pending;
  const report = pending ?? (isEditing ? submitted : undefined);
  const savedMo = isEditing ? submitted?.moPayload : undefined;
  const savedAr = isEditing ? submitted?.arPayload : undefined;

  const initialKind: ReportFormKind | null = crewFormKind(
    report?.formKind,
    report?.slot,
  );

  const [step, setStep] = useState<Step>(() =>
    isEditing || initialKind
      ? 'form'
      : report?.slot === 'mo'
        ? 'chooser'
        : report?.slot === 'ar1' || report?.slot === 'ar2'
          ? 'form'
          : 'chooser',
  );
  const [formKind, setFormKind] = useState<ReportFormKind | null>(() => {
    if (isEditing) {
      return (
        initialKind ??
        (submitted?.moPayload
          ? 'mo_quick'
          : submitted?.arPayload
            ? 'ar_basic'
            : null)
      );
    }
    return report?.slot !== 'mo' ? initialKind : null;
  });
  const [cmoDidNotAttend, setCmoDidNotAttend] = useState(
    () => Boolean(savedMo?.cmoDidNotAttend),
  );
  const [doneCards, setDoneCards] = useState(0);

  const [homePoints, setHomePoints] = useState(() =>
    savedMo && !savedMo.tournamentMatch && savedMo.homePoints != null
      ? String(savedMo.homePoints)
      : '',
  );
  const [awayPoints, setAwayPoints] = useState(() =>
    savedMo && !savedMo.tournamentMatch && savedMo.awayPoints != null
      ? String(savedMo.awayPoints)
      : '',
  );
  const [homeYellow, setHomeYellow] = useState(() =>
    String(savedMo?.homeYellowCards ?? '0'),
  );
  const [homeRed, setHomeRed] = useState(() => String(savedMo?.homeRedCards ?? '0'));
  const [awayYellow, setAwayYellow] = useState(() =>
    String(savedMo?.awayYellowCards ?? '0'),
  );
  const [awayRed, setAwayRed] = useState(() => String(savedMo?.awayRedCards ?? '0'));
  const [isTournament, setIsTournament] = useState(() =>
    savedMo?.tournamentMatch ?? (match ? isTournamentMatch(match) : false),
  );
  const [lightFeedback, setLightFeedback] = useState(
    () => savedMo?.lightFeedback ?? '',
  );
  const [crewAttendance, setCrewAttendance] = useState<CrewAttendanceEntry[]>(
    () =>
      match
        ? attendanceForReportForm(
            match,
            savedMo?.crewAttendance ?? savedAr?.crewAttendance,
          )
        : [],
  );
  const [crewAbsenceNote, setCrewAbsenceNote] = useState(
    () => savedMo?.crewAbsenceNote ?? savedAr?.crewAbsenceNote ?? '',
  );
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (dataMode !== 'live' || !matchId || isEditing) return;
    if (assignerFiling) {
      void ensureMatchReportReadyForAssignee(
        matchId,
        assignerFiling.officialId,
        assignerFiling.slot,
      ).catch((err) =>
        console.error('ensureMatchReportReadyForAssignee failed', err),
      );
      return;
    }
    if (!currentUser) return;
    void ensureMatchReportReady(matchId, currentUser.uid).catch((err) =>
      console.error('ensureMatchReportReady failed', err),
    );
  }, [assignerFiling, dataMode, currentUser?.uid, matchId, isEditing]);

  useEffect(() => {
    if (!match) return;
    setCrewAttendance(
      attendanceForReportForm(
        match,
        savedMo?.crewAttendance ?? savedAr?.crewAttendance,
      ),
    );
    if (!savedMo) setIsTournament(isTournamentMatch(match));
  }, [match?.id]);

  useEffect(() => {
    if (!isEditing || !submitted || !match) return;
    const mo = submitted.moPayload;
    const ar = submitted.arPayload;
    if (mo) {
      setCmoDidNotAttend(Boolean(mo.cmoDidNotAttend));
      setIsTournament(Boolean(mo.tournamentMatch));
      setHomePoints(
        !mo.tournamentMatch && mo.homePoints != null ? String(mo.homePoints) : '',
      );
      setAwayPoints(
        !mo.tournamentMatch && mo.awayPoints != null ? String(mo.awayPoints) : '',
      );
      setHomeYellow(String(mo.homeYellowCards ?? '0'));
      setHomeRed(String(mo.homeRedCards ?? '0'));
      setAwayYellow(String(mo.awayYellowCards ?? '0'));
      setAwayRed(String(mo.awayRedCards ?? '0'));
      setLightFeedback(mo.lightFeedback ?? '');
      setCrewAttendance(attendanceForReportForm(match, mo.crewAttendance));
      setCrewAbsenceNote(mo.crewAbsenceNote ?? '');
      setCrewIssuesNote(mo.crewIssuesNote ?? '');
    }
    if (ar) {
      setStillComfortable(ar.stillComfortable);
      setArIncidents(ar.keyIncidents ?? '');
      setArNote(ar.note ?? '');
      setArMatchFeedback(ar.matchFeedback ?? '');
      setCrewAttendance(attendanceForReportForm(match, ar.crewAttendance));
      setCrewAbsenceNote(ar.crewAbsenceNote ?? '');
      setCrewIssuesNote(ar.crewIssuesNote ?? '');
    }
    const kind = crewFormKind(submitted.formKind, submitted.slot);
    setFormKind(
      kind ??
        (mo ? 'mo_quick' : ar ? 'ar_basic' : null),
    );
    setStep('form');
  }, [isEditing, submitted?.id, match?.id]);

  const [crewIssuesNote, setCrewIssuesNote] = useState(
    () => savedMo?.crewIssuesNote ?? savedAr?.crewIssuesNote ?? '',
  );
  const [stillComfortable, setStillComfortable] = useState<
    ArReportPayload['stillComfortable']
  >(() => savedAr?.stillComfortable ?? '');
  const [arIncidents, setArIncidents] = useState(
    () => savedAr?.keyIncidents ?? '',
  );
  const [arNote, setArNote] = useState(() => savedAr?.note ?? '');
  const [arMatchFeedback, setArMatchFeedback] = useState(
    () => savedAr?.matchFeedback ?? '',
  );
  const [error, setError] = useState<string | null>(null);

  if (!currentUser) return null;

  const filingUser: UserProfile =
    state.users.find((u) => u.uid === filingUserId) ??
    ({
      ...currentUser,
      uid: filingUserId,
      displayName: assignerFiling?.officialName ?? currentUser.displayName,
    } as UserProfile);

  const finishAssignerFiling = () => {
    navigate(assignerFiling!.back.to, { replace: true });
  };

  if (!match) {
    return (
      <div className="rs-stack">
        <Title headingLevel="h2" size="lg">
          Match not found
        </Title>
        <Button
          variant="link"
          onClick={exitFlow}
        >
          Back to {flowBack.label}
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
          {isAssignerFiling && assignerFiling
            ? ` · ${assignerFiling.officialName}`
            : ''}
        </p>
        <Button
          variant="primary"
          onClick={() =>
            navigate(reportHrefForSubmitted(submitted), {
              state: backState(flowBack),
            })
          }
        >
          View report
        </Button>
        {!isAssignerFiling && (
          <>
            <Button
              variant="secondary"
              onClick={() =>
                navigate(matchReportEditPath(match.id), {
                  state: backState(flowBack),
                })
              }
            >
              Edit report
            </Button>
            {submitted.slot === 'mo' && (
              <Button
                variant="secondary"
                onClick={() =>
                  navigate(cardReportPath(match.id), {
                    state: backState(flowBack),
                  })
                }
              >
                Card report
              </Button>
            )}
          </>
        )}
        <Button variant="link" onClick={exitFlow}>
          Back to {flowBack.label}
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
          {isAssignerFiling
            ? 'This crew member has no pending match report on this match. Reset or delete an existing report first if you need them to file again.'
            : 'Open after kickoff + 90 minutes when you are MO, AR1, or AR2 on the crew. No.4 does not file a match report.'}
        </p>
        <Button variant="secondary" onClick={exitFlow}>
          Back to {flowBack.label}
        </Button>
      </div>
    );
  }

  const assignerFilingNote =
    isAssignerFiling && assignerFiling ? (
      <p className="rs-match-card__meta">
        Filing on behalf of {assignerFiling.officialName} (
        {assignerFiling.slot.toUpperCase()})
      </p>
    ) : null;

  const hasCmo = matchHasAssignedCmo(match);
  const quickLocked = isQuickReportLocked(match, cmoDidNotAttend);
  const resolvedKind =
    formKind ??
    (isEditing
      ? crewFormKind(report.formKind, report.slot) ??
        (report.moPayload ? 'mo_quick' : report.arPayload ? 'ar_basic' : null)
      : null);

  const choose = (kind: 'mo_quick' | 'mo_performance') => {
    if (kind === 'mo_quick' && quickLocked) return;
    setFormKind(kind);
    setStep('form');
    setError(null);
  };

  const submitMoPayload = async (
    payload: MoReportPayload,
    kind: ReportFormKind,
  ) => {
    if (!report) return;
    setSubmitting(true);
    try {
      if (dataMode === 'live') {
        await persistSubmittedMatchReport(report.id, kind, payload);
      } else {
        store.submitMatchReport(report.id, kind, payload);
      }
      const { yellow, red } = totalCardsFromMoPayload(payload);
      const total = yellow + red;
      setDoneCards(total);
      if (isEditing) {
        navigate(reportHrefForSubmitted({ ...report, status: 'submitted' }), {
          state: backState(flowBack),
          replace: true,
        });
        return;
      }
      if (isAssignerFiling) {
        finishAssignerFiling();
        return;
      }
      if (total > 0) {
        navigate(cardReportPath(match.id), {
          state: backState(flowBack),
          replace: true,
        });
        return;
      }
      setStep('done');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not save match report.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const submit = async () => {
    if (!resolvedKind || !report) return;
    setError(null);
    setSubmitting(true);

    try {
      if (resolvedKind === 'ar_basic') {
        if (!stillComfortable) {
          setError(
            'Please answer whether you were comfortable as an assistant referee at this level.',
          );
          return;
        }
        const someoneAbsentAr = crewAttendance.some((c) => !c.attended);
        if (someoneAbsentAr && !crewAbsenceNote.trim()) {
          setError('Note who did not attend (and anything we should know).');
          return;
        }
        const arPayload: ArReportPayload = {
          stillComfortable,
          keyIncidents: arIncidents.trim() || undefined,
          note: arNote.trim() || undefined,
          matchFeedback: arMatchFeedback.trim() || undefined,
          crewAttendance,
          crewAbsenceNote: someoneAbsentAr
            ? crewAbsenceNote.trim() || undefined
            : undefined,
          crewIssuesNote: crewIssuesNote.trim() || undefined,
        };
        if (dataMode === 'live') {
          await persistSubmittedMatchReport(report.id, 'ar_basic', arPayload);
        } else {
          store.submitMatchReport(report.id, 'ar_basic', arPayload);
        }
        if (isEditing) {
          navigate(reportHrefForSubmitted({ ...report, status: 'submitted' }), {
            state: backState(flowBack),
            replace: true,
          });
          return;
        }
        if (isAssignerFiling) {
          finishAssignerFiling();
          return;
        }
        setStep('done');
        setDoneCards(0);
        return;
      }

      if (resolvedKind === 'mo_quick' && quickLocked && !isEditing) {
        setError('Confirm that the CMO did not attend to use Quick Report.');
        return;
      }

      const home = Number(homePoints);
      const away = Number(awayPoints);
      const hy = Number(homeYellow);
      const hr = Number(homeRed);
      const ay = Number(awayYellow);
      const ar = Number(awayRed);
      if (!isTournament) {
        if (!Number.isFinite(home) || !Number.isFinite(away)) {
          setError('Enter home and away points.');
          return;
        }
        if ([hy, hr, ay, ar].some((n) => !Number.isFinite(n) || n < 0)) {
          setError('Card counts must be zero or greater.');
          return;
        }
      }
      const someoneAbsent = crewAttendance.some((c) => !c.attended);
      if (someoneAbsent && !crewAbsenceNote.trim()) {
        setError('Note who did not attend (and anything we should know).');
        return;
      }

      const scorePayload = isTournament
        ? tournamentMoScorePayload()
        : {
            homePoints: home,
            awayPoints: away,
            homeYellowCards: hy,
            homeRedCards: hr,
            awayYellowCards: ay,
            awayRedCards: ar,
            yellowCards: hy + ay,
            redCards: hr + ar,
          };

      await submitMoPayload(
        {
          ...scorePayload,
          lightFeedback: lightFeedback.trim() || undefined,
          crewAttendance,
          crewAbsenceNote: someoneAbsent
            ? crewAbsenceNote.trim() || undefined
            : undefined,
          crewIssuesNote: crewIssuesNote.trim() || undefined,
          refereeTeamNote: formatCrewAttendanceNote(crewAttendance) || undefined,
          cmoDidNotAttend: hasCmo && resolvedKind === 'mo_quick' ? true : undefined,
          tournamentMatch: isTournament || undefined,
        },
        'mo_quick',
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not save match report.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (step === 'done') {
    return (
      <div className="rs-stack">
        <Title headingLevel="h2" size="lg">
          {isEditing ? 'Report updated' : 'Report submitted'}
        </Title>
        <p className="rs-match-card__meta">
          {isAssignerFiling && assignerFiling
            ? `${assignerFiling.officialName}'s report for ${match.homeTeamName} vs ${match.awayTeamName} is on file.`
            : `Thanks — ${match.homeTeamName} vs ${match.awayTeamName} is on file.`}
        </p>
        {doneCards > 0 ? (
          <>
            <p className="rs-match-card__meta">
              {isAssignerFiling
                ? 'Cards were noted — the match official still needs to file a card report.'
                : 'You noted cards on this match. A card report is required next.'}
            </p>
            {isAssignerFiling ? (
              <Button variant="secondary" isBlock onClick={finishAssignerFiling}>
                Back to {flowBack.label}
              </Button>
            ) : (
              <Button
                variant="primary"
                isBlock
                onClick={() =>
                  navigate(cardReportPath(match.id), {
                    state: backState(flowBack),
                  })
                }
              >
                File required card report
              </Button>
            )}
          </>
        ) : (
          <Button variant="secondary" onClick={isAssignerFiling ? finishAssignerFiling : exitFlow}>
            Back to {flowBack.label}
          </Button>
        )}
      </div>
    );
  }

  if (!isEditing && (step === 'chooser' || (report.slot === 'mo' && !resolvedKind))) {
    const cmoName = (match.cmo ?? [])
      .map((c) => c.userName)
      .filter(Boolean)
      .join(', ');
    return (
      <div className="rs-stack">
        <button
          type="button"
          className="rs-detail__back"
          onClick={exitFlow}
        >
          ← {flowBackLabel}
        </button>
        <Title headingLevel="h2" size="lg">
          Match report
        </Title>
        {assignerFilingNote}
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
        {!isAssignerFiling && (
          <Button
            variant="link"
            isBlock
            onClick={() =>
              navigate(cardReportPath(match.id), {
                state: backState(flowBack),
              })
            }
          >
            File card report first
          </Button>
        )}
      </div>
    );
  }

  if (resolvedKind === 'mo_performance') {
    return (
      <PerformanceReportForm
        match={match}
        user={filingUser}
        cmoDidNotAttend={cmoDidNotAttend}
        initial={savedMo}
        isUpdate={isEditing}
        onBack={() => {
          if (isEditing) {
            navigate(reportHrefForSubmitted(report), {
              state: backState(flowBack),
            });
            return;
          }
          setFormKind(null);
          setStep('chooser');
        }}
        onSubmit={(payload) => submitMoPayload(payload, 'mo_performance')}
      />
    );
  }

  const kind = resolvedKind ?? 'ar_basic';
  const title = kind === 'mo_quick' ? 'Quick Report' : 'AR Report';

  return (
    <div className="rs-stack">
      <button
        type="button"
        className="rs-detail__back"
        onClick={() => {
          if (isEditing) {
            navigate(reportHrefForSubmitted(report), {
              state: backState(flowBack),
            });
            return;
          }
          if (isAssignerFiling) {
            exitFlow();
            return;
          }
          if (report.slot === 'mo') {
            setFormKind(null);
            setStep('chooser');
          } else {
            exitFlow();
          }
        }}
      >
        ← {isEditing || report.slot !== 'mo' ? flowBackLabel : 'Choose form'}
      </button>
      <Title headingLevel="h2" size="lg">
        {title}
      </Title>
      {assignerFilingNote}
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
            <TournamentMatchCheckbox
              id="quick-tournament"
              checked={isTournament}
              onChange={setIsTournament}
            />
            <TeamScoreCard
              teamName={match.homeTeamName}
              side="home"
              points={homePoints}
              yellow={homeYellow}
              red={homeRed}
              onPoints={setHomePoints}
              onYellow={setHomeYellow}
              onRed={setHomeRed}
              disabled={isTournament}
              idPrefix="mo-home"
            />
            <TeamScoreCard
              teamName={match.awayTeamName}
              side="away"
              points={awayPoints}
              yellow={awayYellow}
              red={awayRed}
              onPoints={setAwayPoints}
              onYellow={setAwayYellow}
              onRed={setAwayRed}
              disabled={isTournament}
              idPrefix="mo-away"
            />
            <CrewAttendanceFields
              crewAttendance={crewAttendance}
              onAttendanceChange={setCrewAttendance}
              crewAbsenceNote={crewAbsenceNote}
              onAbsenceNoteChange={setCrewAbsenceNote}
              crewIssuesNote={crewIssuesNote}
              onIssuesNoteChange={setCrewIssuesNote}
              idPrefix="quick-attend"
            />
            <FormGroup label={MATCH_FEEDBACK_LABEL} fieldId="mo-light">
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
            <FormGroup label={AR_COMFORT_QUESTION} isRequired>
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
            <CrewAttendanceFields
              crewAttendance={crewAttendance}
              onAttendanceChange={setCrewAttendance}
              crewAbsenceNote={crewAbsenceNote}
              onAbsenceNoteChange={setCrewAbsenceNote}
              crewIssuesNote={crewIssuesNote}
              onIssuesNoteChange={setCrewIssuesNote}
              idPrefix="ar-attend"
            />
            <FormGroup label="Key incidents" fieldId="ar-inc">
              <TextArea
                id="ar-inc"
                value={arIncidents}
                onChange={(_e, v) => setArIncidents(v)}
                rows={3}
              />
            </FormGroup>
            <FormGroup
              label={`${MATCH_FEEDBACK_LABEL} (optional)`}
              fieldId="ar-feedback"
            >
              <TextArea
                id="ar-feedback"
                value={arMatchFeedback}
                onChange={(_e, v) => setArMatchFeedback(v)}
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

        <Button type="submit" variant="primary" isBlock isLoading={submitting}>
          {isEditing ? 'Update report' : 'Submit report'}
        </Button>
      </Form>
    </div>
  );
}
