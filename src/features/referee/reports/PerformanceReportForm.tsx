import { useMemo, useState } from 'react';
import {
  Button,
  Form,
  FormGroup,
  TextArea,
  TextInput,
  Title,
} from '@patternfly/react-core';
import {
  BREAKDOWN_REWARD_OPTIONS,
  crewForAttendance,
  MATCH_FEEDBACK_LABEL,
  type BreakdownReward,
  type CrewAttendanceEntry,
  type MatchFormat,
  type MoReportPayload,
} from '@/domain/reports';
import {
  genderLabel,
  type Match,
  type UserProfile,
} from '@/domain/types';
import { CrewAttendanceFields, formatCrewAttendanceNote } from '@/features/referee/reports/CrewAttendanceFields';
import { useScrollReportToTopOnChange } from '@/features/referee/reports/scrollReportToTop';
import { IconDateInput } from '@/ui/IconDateInput';
import { MultiSelectCards } from '@/ui/MultiSelectCards';
import { ScaleRatingCards } from '@/ui/ScaleRatingCards';
import type { FivePointValue } from '@/domain/fivePointScale';

const SECTION_COUNT = 4;
const SECTION_TITLES = [
  'Match details',
  'Snapshot',
  'Reflection',
  'Closing',
] as const;

const SNAPSHOT_SCALE_LEGEND =
  '1 Poor · 2 Below Average · 3 Average · 4 Above Average · 5 Excellent';

function TeamScoreCard({
  teamName,
  side,
  points,
  yellow,
  red,
  onPoints,
  onYellow,
  onRed,
}: {
  teamName: string;
  side: 'home' | 'away';
  points: string;
  yellow: string;
  red: string;
  onPoints: (v: string) => void;
  onYellow: (v: string) => void;
  onRed: (v: string) => void;
}) {
  return (
    <div className="rs-team-score-card">
      <div className="rs-team-score-card__head">
        <span className="rs-pill rs-pill--ink">
          {side === 'home' ? 'Home' : 'Away'}
        </span>
        <strong>{teamName}</strong>
      </div>
      <div className="rs-form-grid-3">
        <FormGroup label="Points" isRequired fieldId={`${side}-pts`}>
          <TextInput
            id={`${side}-pts`}
            type="number"
            value={points}
            onChange={(_e, v) => onPoints(v)}
          />
        </FormGroup>
        <FormGroup label="YC" isRequired fieldId={`${side}-yc`}>
          <TextInput
            id={`${side}-yc`}
            type="number"
            min={0}
            value={yellow}
            onChange={(_e, v) => onYellow(v)}
          />
        </FormGroup>
        <FormGroup label="RC" isRequired fieldId={`${side}-rc`}>
          <TextInput
            id={`${side}-rc`}
            type="number"
            min={0}
            value={red}
            onChange={(_e, v) => onRed(v)}
          />
        </FormGroup>
      </div>
    </div>
  );
}

export function PerformanceReportForm({
  match,
  user,
  cmoDidNotAttend,
  onBack,
  onSubmit,
}: {
  match: Match;
  user: UserProfile;
  cmoDidNotAttend: boolean;
  onBack: () => void;
  onSubmit: (payload: MoReportPayload) => void;
}) {
  const [section, setSection] = useState(0);
  const reportTopRef = useScrollReportToTopOnChange(section);
  const [error, setError] = useState<string | null>(null);

  const [crewAttendance, setCrewAttendance] = useState<CrewAttendanceEntry[]>(
    () => crewForAttendance(match),
  );
  const [crewAbsenceNote, setCrewAbsenceNote] = useState('');
  const [crewIssuesNote, setCrewIssuesNote] = useState('');

  const someoneAbsent = useMemo(
    () => crewAttendance.some((c) => !c.attended),
    [crewAttendance],
  );

  const [refereeName, setRefereeName] = useState(user.displayName);
  const [matchDate, setMatchDate] = useState(match.kickoffAt.slice(0, 10));
  const [format, setFormat] = useState<MatchFormat | ''>('15s');
  const [division, setDivision] = useState(
    `${genderLabel(match.gender)} ${match.level}`,
  );
  const [homePoints, setHomePoints] = useState('');
  const [awayPoints, setAwayPoints] = useState('');
  const [homeYellow, setHomeYellow] = useState('0');
  const [homeRed, setHomeRed] = useState('0');
  const [awayYellow, setAwayYellow] = useState('0');
  const [awayRed, setAwayRed] = useState('0');

  const [gameTemperature, setGameTemperature] = useState<number | ''>('');
  const [controlAndFlow, setControlAndFlow] = useState<number | ''>('');
  const [todayIPerformed, setTodayIPerformed] = useState('');

  const [momentAndDecision, setMomentAndDecision] = useState('');
  const [breakdownRewards, setBreakdownRewards] = useState<BreakdownReward[]>(
    [],
  );
  const [setPieceChallenge, setSetPieceChallenge] = useState('');
  const [advantageUse, setAdvantageUse] = useState<number | ''>('');

  const [nonCardProblems, setNonCardProblems] = useState('');
  const [otherCommentsOrLink, setOtherCommentsOrLink] = useState('');
  const [matchFeedback, setMatchFeedback] = useState('');

  const sectionErrors = (idx: number): string | null => {
    if (idx === 0) {
      if (!refereeName.trim()) return 'Referee name is required.';
      if (!matchDate) return 'Match date is required.';
      if (!format) return 'Select match format (7s / 10s / 15s).';
      if (!division.trim()) return 'Division is required.';
      const hp = Number(homePoints);
      const ap = Number(awayPoints);
      if (!Number.isFinite(hp) || !Number.isFinite(ap)) {
        return 'Enter home and away points.';
      }
      for (const [label, v] of [
        ['Home YC', homeYellow],
        ['Home RC', homeRed],
        ['Away YC', awayYellow],
        ['Away RC', awayRed],
      ] as const) {
        const n = Number(v);
        if (!Number.isFinite(n) || n < 0) {
          return `${label} must be zero or greater.`;
        }
      }
      if (someoneAbsent && !crewAbsenceNote.trim()) {
        return 'Note who did not attend (and anything we should know).';
      }
    }
    if (idx === 1) {
      if (gameTemperature === '') return 'Rate game temperature.';
      if (controlAndFlow === '') return 'Rate control & flow.';
      if (!todayIPerformed.trim()) return 'Complete “Today I performed…”.';
    }
    if (idx === 2) {
      if (!momentAndDecision.trim()) {
        return 'Describe the key moment and what you decided.';
      }
      if (breakdownRewards.length === 0) {
        return 'Select at least one breakdown reward.';
      }
      if (!setPieceChallenge.trim()) {
        return 'Describe the biggest set-piece challenge.';
      }
      if (advantageUse === '') return 'Rate advantage use.';
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
    if (section === 0) onBack();
    else setSection((s) => s - 1);
  };

  const finish = () => {
    const incomplete = firstIncompleteSection();
    if (incomplete >= 0) {
      setSection(incomplete);
      setError(sectionErrors(incomplete));
      return;
    }
    const hy = Number(homeYellow);
    const hr = Number(homeRed);
    const ay = Number(awayYellow);
    const ar = Number(awayRed);
    const payload: MoReportPayload = {
      homePoints: Number(homePoints),
      awayPoints: Number(awayPoints),
      homeYellowCards: hy,
      homeRedCards: hr,
      awayYellowCards: ay,
      awayRedCards: ar,
      yellowCards: hy + ay,
      redCards: hr + ar,
      refereeName: refereeName.trim(),
      matchDate,
      format: format as MatchFormat,
      division: division.trim(),
      homeTeamName: match.homeTeamName,
      awayTeamName: match.awayTeamName,
      crewAttendance,
      crewAbsenceNote: someoneAbsent
        ? crewAbsenceNote.trim() || undefined
        : undefined,
      crewIssuesNote: crewIssuesNote.trim() || undefined,
      refereeTeamNote: formatCrewAttendanceNote(crewAttendance) || undefined,
      gameTemperature: gameTemperature as number,
      controlAndFlow: controlAndFlow as number,
      todayIPerformed: todayIPerformed.trim(),
      typeOfMoment: momentAndDecision.trim().slice(0, 120),
      decidedAndWhy: momentAndDecision.trim(),
      breakdownRewards,
      setPieceChallenge: setPieceChallenge.trim(),
      advantageUse: advantageUse as number,
      nonCardProblems: nonCardProblems.trim() || undefined,
      otherCommentsOrLink: otherCommentsOrLink.trim() || undefined,
      lightFeedback: matchFeedback.trim() || undefined,
      cmoDidNotAttend: cmoDidNotAttend || undefined,
    };
    onSubmit(payload);
  };

  return (
    <div className="rs-stack rs-perf-report">
      <button type="button" className="rs-detail__back" onClick={goPrev}>
        ← {section === 0 ? 'Choose form' : SECTION_TITLES[section - 1]}
      </button>
      <Title headingLevel="h2" size="lg" className="rs-perf-report__title">
        Performance Report
      </Title>

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
          else finish();
        }}
      >
        {section === 0 && (
          <>
            <FormGroup label="Referee name" isRequired fieldId="perf-name">
              <TextInput
                id="perf-name"
                value={refereeName}
                onChange={(_e, v) => setRefereeName(v)}
              />
            </FormGroup>
            <div className="rs-form-grid-2">
              <FormGroup label="Date of match" isRequired fieldId="perf-date">
                <IconDateInput
                  id="perf-date"
                  type="date"
                  value={matchDate}
                  onChange={(_e, v) => setMatchDate(v)}
                />
              </FormGroup>
              <FormGroup label="Division" isRequired fieldId="perf-div">
                <TextInput
                  id="perf-div"
                  value={division}
                  onChange={(_e, v) => setDivision(v)}
                  placeholder="e.g. Men’s D1, Friendly"
                />
              </FormGroup>
            </div>
            <FormGroup label="Format" isRequired>
              <div
                className="rs-slot-picker"
                role="radiogroup"
                aria-label="Format"
              >
                {(['7s', '10s', '15s'] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    role="radio"
                    aria-checked={format === f}
                    className={`rs-filter-chip${
                      format === f ? ' rs-filter-chip--selected' : ''
                    }`}
                    onClick={() => setFormat(f)}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </FormGroup>

            <TeamScoreCard
              teamName={match.homeTeamName}
              side="home"
              points={homePoints}
              yellow={homeYellow}
              red={homeRed}
              onPoints={setHomePoints}
              onYellow={setHomeYellow}
              onRed={setHomeRed}
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
            />

            <CrewAttendanceFields
              crewAttendance={crewAttendance}
              onAttendanceChange={setCrewAttendance}
              crewAbsenceNote={crewAbsenceNote}
              onAbsenceNoteChange={setCrewAbsenceNote}
              crewIssuesNote={crewIssuesNote}
              onIssuesNoteChange={setCrewIssuesNote}
            />
          </>
        )}

        {section === 1 && (
          <section className="rs-detail-card rs-coach-fb-ratings">
            <p className="rs-match-card__meta rs-coach-fb-scale-legend">
              {SNAPSHOT_SCALE_LEGEND}
            </p>
            <div className="rs-coach-fb-criterion">
              <div className="rs-coach-fb-criterion__head">
                <span className="rs-coach-fb-criterion__title">
                  Game temperature (1–5)
                </span>
                <p className="rs-coach-fb-criterion__hint">
                  How emotional/physical the game felt overall. 1 = friendly/social
                  vibe. 3 = competitive but manageable. 5 = very hot. (Match
                  environment, not your performance.)
                </p>
              </div>
              <ScaleRatingCards
                name="perf-temp"
                value={
                  gameTemperature === ''
                    ? undefined
                    : (gameTemperature as FivePointValue)
                }
                onChange={(v) => {
                  if (typeof v === 'number') setGameTemperature(v);
                }}
                includeNa={false}
                ariaLabel="Game temperature"
                labels={{ 1: 'Calm', 5: 'Hot' }}
              />
            </div>
            <div className="rs-coach-fb-criterion">
              <div className="rs-coach-fb-criterion__head">
                <span className="rs-coach-fb-criterion__title">
                  Control &amp; flow (1–5)
                </span>
                <p className="rs-coach-fb-criterion__hint">
                  How well you set standards and kept the game moving. 1 =
                  reactive. 3 = mixed. 5 = proactive: clear standards early,
                  effective prevention.
                </p>
              </div>
              <ScaleRatingCards
                name="perf-control"
                value={
                  controlAndFlow === ''
                    ? undefined
                    : (controlAndFlow as FivePointValue)
                }
                onChange={(v) => {
                  if (typeof v === 'number') setControlAndFlow(v);
                }}
                includeNa={false}
                ariaLabel="Control and flow"
                labels={{ 1: 'Reactive', 5: 'Proactive' }}
              />
            </div>
            <FormGroup
              label="Today I performed…"
              isRequired
              fieldId="perf-today"
            >
              <p className="rs-scale-field__criteria">
                How do you think you did and why…
              </p>
              <TextArea
                id="perf-today"
                value={todayIPerformed}
                onChange={(_e, v) => setTodayIPerformed(v)}
                rows={4}
              />
            </FormGroup>
          </section>
        )}

        {section === 2 && (
          <>
            <FormGroup
              label="Key moment — what did you decide and why?"
              isRequired
              fieldId="perf-moment"
            >
              <p className="rs-scale-field__criteria">
                Name the moment most likely to change the match or tone (YC/RC,
                foul play, PK, advantage, captain management) and explain the
                decision. Example: &quot;YC #3 Blue (repeated offside) —
                Materiality: stopped third line break; prior warning at
                25&apos;, then card.&quot;
              </p>
              <TextArea
                id="perf-moment"
                value={momentAndDecision}
                onChange={(_e, v) => setMomentAndDecision(v)}
                rows={5}
              />
            </FormGroup>
            <FormGroup
              label="Breakdown: What did you reward most?"
              isRequired
            >
              <p className="rs-scale-field__criteria">
                Select everything you consistently rewarded that shaped the
                contest.
              </p>
              <MultiSelectCards
                name="perf-bd"
                options={BREAKDOWN_REWARD_OPTIONS}
                selected={breakdownRewards}
                onChange={setBreakdownRewards}
                ariaLabel="Breakdown rewards"
              />
            </FormGroup>
            <FormGroup
              label="Set piece: Biggest challenge today"
              isRequired
              fieldId="perf-set"
            >
              <p className="rs-scale-field__criteria">
                The main pattern you had to manage most. Choose the single
                biggest theme.
              </p>
              <TextArea
                id="perf-set"
                value={setPieceChallenge}
                onChange={(_e, v) => setSetPieceChallenge(v)}
                rows={3}
              />
            </FormGroup>
            <div className="rs-coach-fb-criterion">
              <div className="rs-coach-fb-criterion__head">
                <span className="rs-coach-fb-criterion__title">
                  Advantage use (1–5)
                </span>
                <p className="rs-coach-fb-criterion__hint">
                  How purposeful and outcome-focused your advantage was. 1 =
                  rarely/unclearly played. 3 = sometimes played but outcomes
                  unclear. 5 = clear signals, real gain, brought back promptly
                  when no benefit.
                </p>
              </div>
              <ScaleRatingCards
                name="perf-adv"
                value={
                  advantageUse === '' ? undefined : (advantageUse as FivePointValue)
                }
                onChange={(v) => {
                  if (typeof v === 'number') setAdvantageUse(v);
                }}
                includeNa={false}
                ariaLabel="Advantage use"
                labels={{ 1: 'Rarely', 5: 'Clear' }}
              />
            </div>
          </>
        )}

        {section === 3 && (
          <>
            <FormGroup
              label="Any problems from teams/players/coaches that are not card reports"
              fieldId="perf-problems"
            >
              <TextArea
                id="perf-problems"
                value={nonCardProblems}
                onChange={(_e, v) => setNonCardProblems(v)}
                rows={3}
              />
            </FormGroup>
            <FormGroup
              label="Any other comments? Add a game link here if you have one."
              fieldId="perf-other"
            >
              <TextArea
                id="perf-other"
                value={otherCommentsOrLink}
                onChange={(_e, v) => setOtherCommentsOrLink(v)}
                rows={3}
              />
            </FormGroup>
            <FormGroup label={MATCH_FEEDBACK_LABEL} fieldId="perf-feedback">
              <TextArea
                id="perf-feedback"
                value={matchFeedback}
                onChange={(_e, v) => setMatchFeedback(v)}
                rows={3}
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
            {section < SECTION_COUNT - 1 ? 'Continue' : 'Submit report'}
          </Button>
        </div>
      </Form>
    </div>
  );
}
