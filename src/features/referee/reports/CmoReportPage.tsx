import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
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
  CMO_BALANCE_CARD_LABELS,
  CMO_COMPLEXITY_OPTIONS,
  CMO_CONFIDENCE_CARD_LABELS,
  CMO_MATCH_KINDS,
  CMO_SCALE_KEYS,
  CMO_SCALE_LABELS,
  CMO_TEMPERATURE_CARD_LABELS,
  cmoComplexityComplete,
  parseAssessedRating,
  validateCmoScales,
  moOfficialIdsOnMatch,
  resolveCmoReportForUserOnMatch,
  type CmoComplexityFactor,
  type CmoMatchKind,
  type CmoReportPayload,
  type CmoScaleKey,
} from '@/domain/reports';
import { isFivePointValue, type FivePointChoice, type FivePointValue } from '@/domain/fivePointScale';
import { crewPeople, type Match } from '@/domain/types';
import { moDisplayNames } from '@/features/referee/appointments/crewLines';
import {
  cmoReportPath,
  cmoReportViewPath,
} from '@/features/referee/reports/reportLinks';
import { RefereeLevelChart } from '@/ui/RefereeLevelChart';
import { ScaleRatingCards } from '@/ui/ScaleRatingCards';
import {
  ensureCmoReportReady,
  persistSubmittedCmoReport,
} from '@/services/reportsLive';
import { useScrollReportToTopOnChange } from '@/features/referee/reports/scrollReportToTop';

const SECTION_COUNT = 4;
const SECTION_TITLES = [
  'Match context',
  'Scales',
  'Next steps',
  'Snapshot',
] as const;

function LinearScaleCards({
  id,
  label,
  description,
  value,
  onChange,
  labels,
}: {
  id: string;
  label: string;
  description: string;
  value: number | '';
  onChange: (n: number) => void;
  labels: Partial<Record<FivePointValue, string>>;
}) {
  return (
    <div className="rs-scale-field">
      <FormGroup label={`${label} (1–5)`} isRequired fieldId={`${id}-1`}>
        <p className="rs-scale-field__criteria">{description}</p>
        <ScaleRatingCards
          name={id}
          includeNa={false}
          labels={labels}
          value={isFivePointValue(value) ? value : undefined}
          onChange={(v) => {
            if (typeof v === 'number') onChange(v);
          }}
          ariaLabel={label}
        />
      </FormGroup>
    </div>
  );
}

function moNameForUser(
  match: Match,
  userId: string,
  users: { uid: string; displayName?: string }[],
): string {
  const assignment = crewPeople(match.crew.mo).find((a) => a.userId === userId);
  if (assignment?.userName) return assignment.userName;
  return users.find((u) => u.uid === userId)?.displayName ?? 'Match Official';
}

export function CmoReportPage() {
  const { matchId = '' } = useParams();
  const [searchParams] = useSearchParams();
  const subjectFromQuery = searchParams.get('subjectOfficialId') ?? '';
  const { currentUser, state, store, dataMode } = useApp();
  const navigate = useNavigate();

  const match = state.matches.find((m) => m.id === matchId);
  const moIds = useMemo(
    () => (match ? moOfficialIdsOnMatch(match) : []),
    [match],
  );
  const effectiveSubjectId =
    subjectFromQuery || (moIds.length === 1 ? moIds[0]! : '');

  const report = useMemo(() => {
    if (!currentUser || !matchId || !match || !effectiveSubjectId) {
      return undefined;
    }
    const hit = resolveCmoReportForUserOnMatch(
      state.matchReports,
      match,
      currentUser.uid,
      effectiveSubjectId,
    );
    return hit?.status === 'pending' ? hit : undefined;
  }, [
    currentUser,
    matchId,
    match,
    effectiveSubjectId,
    state.matchReports,
  ]);

  const subjectMoName = useMemo(() => {
    if (!match || !effectiveSubjectId) return moDisplayNames(match!);
    return moNameForUser(match, effectiveSubjectId, state.users);
  }, [match, effectiveSubjectId, state.users]);

  const [section, setSection] = useState(0);
  const reportTopRef = useScrollReportToTopOnChange(section);
  const [scales, setScales] = useState<
    Partial<Record<CmoScaleKey, FivePointChoice>>
  >({});
  const [comments, setComments] = useState<
    Partial<Record<CmoScaleKey, string>>
  >({});
  const [playedLike, setPlayedLike] = useState('');
  const [matchKind, setMatchKind] = useState<CmoMatchKind | ''>('');
  const [gameTemperature, setGameTemperature] = useState<number | ''>('');
  const [contestBalance, setContestBalance] = useState<number | ''>('');
  const [complexityFactors, setComplexityFactors] = useState<
    CmoComplexityFactor[]
  >([]);
  const [complexityOther, setComplexityOther] = useState('');
  const [penaltyCount, setPenaltyCount] = useState('');
  const [attendedInPerson, setAttendedInPerson] = useState<'yes' | 'no' | ''>(
    '',
  );
  const [videoLink, setVideoLink] = useState('');
  const [keep, setKeep] = useState('');
  const [start, setStart] = useState('');
  const [stop, setStop] = useState('');
  const [overallComment, setOverallComment] = useState('');
  const [assessedRating, setAssessedRating] = useState('');
  const [gradingConfidence, setGradingConfidence] = useState<number | ''>('');
  const [gradingRationale, setGradingRationale] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (dataMode !== 'live' || !currentUser || !matchId || !effectiveSubjectId) {
      return;
    }
    void ensureCmoReportReady(
      matchId,
      currentUser.uid,
      effectiveSubjectId,
    ).catch((err) => console.error('ensureCmoReportReady failed', err));
  }, [dataMode, currentUser?.uid, matchId, effectiveSubjectId]);

  const toggleComplexity = (opt: CmoComplexityFactor, checked: boolean) => {
    setComplexityFactors((prev) =>
      checked ? [...prev, opt] : prev.filter((x) => x !== opt),
    );
  };

  const sectionErrors = (idx: number): string | null => {
    if (idx === 0) {
      if (!attendedInPerson) return 'Say whether you attended in person.';
      if (!playedLike.trim()) {
        return 'Describe what level this game played like.';
      }
      if (!matchKind) return 'Select match type (League, Friendly, Play-off, or Championship).';
      if (gameTemperature === '') return 'Rate the temperature of this game.';
      if (contestBalance === '') return 'Rate contest balance.';
      if (!cmoComplexityComplete(complexityFactors, complexityOther)) {
        return 'Select at least one complexity factor (or describe Other).';
      }
    }
    if (idx === 1) {
      if (!validateCmoScales(scales, CMO_SCALE_KEYS)) {
        return 'Rate every scale from 1–5, or N/A.';
      }
    }
    if (idx === 2) {
      if (!keep.trim()) return 'Complete Keep (one strength to continue).';
      if (!start.trim()) return 'Complete Start (a small habit to add).';
      if (!stop.trim()) return 'Complete Stop (a behavior to drop).';
      if (!overallComment.trim()) return 'Add coach open comments.';
    }
    if (idx === 3) {
      if (parseAssessedRating(assessedRating) == null) {
        return `Enter an assessed rating from ${CMO_ASSESSED_RATING_MIN}–${CMO_ASSESSED_RATING_MAX} (${CMO_ASSESSED_RATING_MIN} highest, ${CMO_ASSESSED_RATING_MAX} lowest).`;
      }
      if (gradingConfidence === '' || !isFivePointValue(gradingConfidence)) {
        return 'Rate your confidence in this grade.';
      }
      if (!gradingRationale.trim()) return 'Add a rationale on grading.';
    }
    return null;
  };

  const firstIncompleteSection = (): number => {
    for (let i = 0; i < SECTION_COUNT; i++) {
      if (sectionErrors(i)) return i;
    }
    return -1;
  };

  const goSection = (idx: number) => {
    setError(null);
    setSection(idx);
  };

  const goNext = () => {
    setError(null);
    setSection((s) => Math.min(SECTION_COUNT - 1, s + 1));
  };

  const goPrev = () => {
    setError(null);
    if (section === 0) {
      navigate('/referee/reports/coaching');
      return;
    }
    setSection((s) => s - 1);
  };

  const finish = async () => {
    const incomplete = firstIncompleteSection();
    if (incomplete >= 0) {
      setSection(incomplete);
      setError(sectionErrors(incomplete));
      return;
    }
    const rating = parseAssessedRating(assessedRating);
    if (rating == null || !match) return;
    const payload: CmoReportPayload = {
      scales,
      comments,
      playedLike: playedLike.trim(),
      matchKind: matchKind as CmoMatchKind,
      gameTemperature: gameTemperature as number,
      contestBalance: contestBalance as number,
      complexityFactors,
      complexityOther: complexityOther.trim() || undefined,
      penaltyCount: penaltyCount.trim() || undefined,
      attendedInPerson: attendedInPerson as 'yes' | 'no',
      videoLink: videoLink.trim() || undefined,
      keep: keep.trim(),
      start: start.trim(),
      stop: stop.trim(),
      overallComment: overallComment.trim(),
      assessedRating: rating,
      gradingConfidence: gradingConfidence as number,
      gradingRationale: gradingRationale.trim(),
    };
    try {
      if (dataMode === 'live') {
        await persistSubmittedCmoReport(
          report!.id,
          payload,
          effectiveSubjectId,
        );
      } else {
        store.submitCmoReport(report!.id, payload, effectiveSubjectId);
      }
      setDone(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not save CMO report.',
      );
    }
  };

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

  if (moIds.length > 1 && !subjectFromQuery) {
    const myCmoReports = state.matchReports.filter(
      (r) =>
        r.matchId === matchId &&
        r.officialId === currentUser.uid &&
        r.slot === 'cmo',
    );
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
          Choose match official
        </Title>
        <p className="rs-match-card__meta">
          {match.homeTeamName} vs {match.awayTeamName} has multiple match
          officials. File a separate coaching report for each one you assessed.
        </p>
        <ul className="rs-list">
          {moIds.map((moId) => {
            const row = myCmoReports.find(
              (r) =>
                r.subjectOfficialId === moId ||
                (!r.subjectOfficialId && moIds.length === 1),
            );
            const status = row?.status === 'submitted' ? 'Submitted' : 'Due';
            const name = moNameForUser(match, moId, state.users);
            return (
              <li key={moId}>
                <button
                  type="button"
                  className="rs-list-row rs-list-row--button"
                  onClick={() =>
                    navigate(cmoReportPath(matchId, moId))
                  }
                >
                  <span className="rs-list-row__title">{name}</span>
                  <span className="rs-pill">{status}</span>
                </button>
              </li>
            );
          })}
        </ul>
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
          onClick={() =>
            navigate(cmoReportViewPath(matchId, effectiveSubjectId))
          }
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

  if (!report) {
    const submitted = resolveCmoReportForUserOnMatch(
      state.matchReports,
      match,
      currentUser.uid,
      effectiveSubjectId,
    );
    const alreadySubmitted = submitted?.status === 'submitted' ? submitted : undefined;
    return (
      <div className="rs-stack">
        <Title headingLevel="h2" size="lg">
          {alreadySubmitted ? 'CMO report already submitted' : 'No CMO report due'}
        </Title>
        <p className="rs-match-card__meta">
          {match.homeTeamName} vs {match.awayTeamName}
          {effectiveSubjectId ? ` · MO ${subjectMoName}` : ''}. Notices open at
          kickoff + 90 minutes; complete within 48 hours of kickoff.
        </p>
        {alreadySubmitted && (
          <Button
            variant="primary"
            onClick={() =>
              navigate(cmoReportViewPath(matchId, effectiveSubjectId))
            }
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

  const deadline = report.deadlineAt
    ? new Date(report.deadlineAt).toLocaleString()
    : null;

  return (
    <div className="rs-stack rs-cmo-report">
      <button type="button" className="rs-detail__back" onClick={goPrev}>
        ← {section === 0 ? 'Coaching Reports' : SECTION_TITLES[section - 1]}
      </button>
      <Title headingLevel="h2" size="lg" className="rs-cmo-report__title">
        CMO report
      </Title>
      <p className="rs-match-card__meta">
        {match.homeTeamName} vs {match.awayTeamName} · MO {subjectMoName}
      </p>
      {deadline && (
        <p className="rs-match-card__meta">
          Please complete within 48 hours of kickoff (by {deadline}).
        </p>
      )}

      <nav
        ref={reportTopRef}
        className="rs-report-stepper"
        aria-label="Report sections"
      >
        {SECTION_TITLES.map((title, idx) => (
          <button
            key={title}
            type="button"
            className={`rs-report-stepper__step${
              idx === section ? ' rs-report-stepper__step--current' : ''
            }${idx < section ? ' rs-report-stepper__step--done' : ''}`}
            aria-current={idx === section ? 'step' : undefined}
            onClick={() => goSection(idx)}
          >
            <span className="rs-report-stepper__num">{idx + 1}</span>
            <span className="rs-report-stepper__label">{title}</span>
          </button>
        ))}
      </nav>

      <Form
        onSubmit={(e) => {
          e.preventDefault();
          if (section < SECTION_COUNT - 1) goNext();
          else void finish();
        }}
      >
        {section === 0 && (
          <>
            <FormGroup label="Did you attend the game in person?" isRequired>
              <div
                className="rs-cmo-select-cards rs-cmo-select-cards--kinds"
                role="radiogroup"
                aria-label="Attended in person"
              >
                {(['yes', 'no'] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    role="radio"
                    aria-checked={attendedInPerson === v}
                    className={`rs-cmo-select-cards__card${
                      attendedInPerson === v
                        ? ' rs-cmo-select-cards__card--selected'
                        : ''
                    }`}
                    onClick={() => setAttendedInPerson(v)}
                  >
                    {v === 'yes' ? 'Yes' : 'No'}
                  </button>
                ))}
              </div>
            </FormGroup>
            <FormGroup
              label="If there is a video link to the game, please list here."
              fieldId="cmo-video"
            >
              <TextInput
                id="cmo-video"
                value={videoLink}
                onChange={(_e, v) => setVideoLink(v)}
              />
            </FormGroup>
            <FormGroup
              label="This game played like a …"
              isRequired
              fieldId="cmo-played-like"
            >
              <p className="rs-scale-field__criteria">
                What level of game did the match feel like? For instance, though
                it might be a Mens D1 game, the skill level could feel like Mens
                D3.
              </p>
              <TextArea
                id="cmo-played-like"
                value={playedLike}
                onChange={(_e, v) => setPlayedLike(v)}
                rows={2}
              />
            </FormGroup>
            <FormGroup label="Match type" isRequired>
              <p className="rs-scale-field__criteria">
                League match, friendly, play-off, or championship.
              </p>
              <div
                className="rs-cmo-select-cards rs-cmo-select-cards--kinds"
                role="radiogroup"
                aria-label="Match type"
              >
                {CMO_MATCH_KINDS.map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    role="radio"
                    aria-checked={matchKind === kind}
                    className={`rs-cmo-select-cards__card${
                      matchKind === kind
                        ? ' rs-cmo-select-cards__card--selected'
                        : ''
                    }`}
                    onClick={() => setMatchKind(kind)}
                  >
                    {kind}
                  </button>
                ))}
              </div>
            </FormGroup>
            <LinearScaleCards
              id="cmo-temp"
              label="The temperature of this game was"
              description="How emotional/physical the contest was. 1 = friendly/social vibe, low emotion. 3 = competitive but manageable. 5 = very hot: high stakes, flashpoints, multiple warnings/cards."
              labels={CMO_TEMPERATURE_CARD_LABELS}
              value={gameTemperature}
              onChange={setGameTemperature}
            />
            <LinearScaleCards
              id="cmo-balance"
              label="Contest balance"
              description="How even the teams were. 1 = heavy mismatch; 3 = somewhat uneven; 5 = very even contest. Score doesn’t dictate balance."
              labels={CMO_BALANCE_CARD_LABELS}
              value={contestBalance}
              onChange={setContestBalance}
            />
            <FormGroup label="Complexity factors" isRequired>
              <p className="rs-scale-field__criteria">
                What made this harder to manage (select all that apply).
              </p>
              <div
                className="rs-cmo-select-cards"
                role="group"
                aria-label="Complexity factors"
              >
                {CMO_COMPLEXITY_OPTIONS.map((opt) => {
                  const selected = complexityFactors.includes(opt);
                  return (
                    <button
                      key={opt}
                      type="button"
                      className={`rs-cmo-select-cards__card${
                        selected ? ' rs-cmo-select-cards__card--selected' : ''
                      }`}
                      aria-pressed={selected}
                      onClick={() => toggleComplexity(opt, !selected)}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
              <FormGroup
                label="Other"
                fieldId="cmo-complexity-other"
                className="rs-cmo-report__other"
              >
                <TextInput
                  id="cmo-complexity-other"
                  value={complexityOther}
                  onChange={(_e, v) => setComplexityOther(v)}
                />
              </FormGroup>
            </FormGroup>
            <FormGroup
              label="If you know the penalty count (even roughly), list it here…"
              fieldId="cmo-pk"
            >
              <p className="rs-scale-field__criteria">
                Example: 32 Total… 20 home 12 away
              </p>
              <TextInput
                id="cmo-pk"
                value={penaltyCount}
                onChange={(_e, v) => setPenaltyCount(v)}
              />
            </FormGroup>
          </>
        )}

        {section === 1 && (
          <section className="rs-detail-card rs-coach-fb-ratings">
            <p className="rs-match-card__meta rs-coach-fb-scale-legend">
              1 Poor · 2 Below Average · 3 Average · 4 Above Average · 5
              Excellent · N/A not applicable.
            </p>
            {CMO_SCALE_KEYS.map((key) => (
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
        )}

        {section === 2 && (
          <>
            <FormGroup label="Keep" isRequired fieldId="cmo-keep">
              <p className="rs-scale-field__criteria">
                One strength that clearly worked today and should continue.
              </p>
              <TextArea
                id="cmo-keep"
                value={keep}
                onChange={(_e, v) => setKeep(v)}
                rows={3}
              />
            </FormGroup>
            <FormGroup label="Start" isRequired fieldId="cmo-start">
              <p className="rs-scale-field__criteria">
                A new habit to add for next match (specific and small).
              </p>
              <TextArea
                id="cmo-start"
                value={start}
                onChange={(_e, v) => setStart(v)}
                rows={3}
              />
            </FormGroup>
            <FormGroup label="Stop" isRequired fieldId="cmo-stop">
              <p className="rs-scale-field__criteria">
                A behavior to drop that didn’t help today.
              </p>
              <TextArea
                id="cmo-stop"
                value={stop}
                onChange={(_e, v) => setStop(v)}
                rows={3}
              />
            </FormGroup>
            <FormGroup
              label="Coach open comments"
              isRequired
              fieldId="cmo-overall"
            >
              <TextArea
                id="cmo-overall"
                value={overallComment}
                onChange={(_e, v) => setOverallComment(v)}
                rows={3}
              />
            </FormGroup>
          </>
        )}

        {section === 3 && (
          <>
            <p className="rs-scale-field__criteria">
              Judge against the expected standard for the appointed level (not
              absolute perfection).
            </p>
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
                Whole number {CMO_ASSESSED_RATING_MIN}–
                {CMO_ASSESSED_RATING_MAX}. {CMO_ASSESSED_RATING_MIN} is the
                highest grade; {CMO_ASSESSED_RATING_MAX} is the lowest.
              </p>
            </FormGroup>
            <LinearScaleCards
              id="cmo-confidence"
              label="Confidence in estimate"
              description="1 = guess / low evidence; 3 = moderate; 5 = very confident based on clear patterns."
              labels={CMO_CONFIDENCE_CARD_LABELS}
              value={gradingConfidence}
              onChange={setGradingConfidence}
            />
            <FormGroup
              label="Rationale on grading"
              isRequired
              fieldId="cmo-rationale"
            >
              <TextArea
                id="cmo-rationale"
                value={gradingRationale}
                onChange={(_e, v) => setGradingRationale(v)}
                rows={4}
              />
            </FormGroup>
            <p className="rs-match-card__meta">
              You can browse all sections with the stepper above. Submit stays
              blocked until every required field is complete.
            </p>
          </>
        )}

        {error && (
          <p className="rs-match-card__meta" role="alert">
            {error}
          </p>
        )}

        <div className="rs-report-chooser__actions">
          <Button type="button" variant="secondary" onClick={goPrev}>
            Back
          </Button>
          <Button type="submit" variant="primary" className="rs-btn--gold">
            {section < SECTION_COUNT - 1 ? 'Continue' : 'Submit CMO report'}
          </Button>
        </div>
      </Form>
    </div>
  );
}
