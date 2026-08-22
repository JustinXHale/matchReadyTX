import { useMemo, useState } from 'react';
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
import {
  BREAKDOWN_REWARD_OPTIONS,
  crewForAttendance,
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
import { IconDateInput } from '@/ui/IconDateInput';

const SECTION_COUNT = 4;
const SECTION_TITLES = [
  'Match details',
  'Snapshot',
  'Reflection',
  'Closing',
] as const;

function ScaleField({
  id,
  label,
  description,
  lowLabel,
  highLabel,
  value,
  onChange,
}: {
  id: string;
  label: string;
  description: string;
  lowLabel: string;
  highLabel: string;
  value: number | '';
  onChange: (n: number) => void;
}) {
  return (
    <div className="rs-scale-field">
      <FormGroup label={`${label} (1–5)`} isRequired fieldId={id}>
        <p className="rs-scale-field__criteria">{description}</p>
        <div className="rs-scale-row" role="radiogroup" aria-label={label}>
          <span className="rs-scale-row__anchor">{lowLabel}</span>
          {[1, 2, 3, 4, 5].map((n) => (
            <Radio
              key={n}
              id={`${id}-${n}`}
              name={id}
              label={String(n)}
              isChecked={value === n}
              onChange={() => onChange(n)}
            />
          ))}
          <span className="rs-scale-row__anchor">{highLabel}</span>
        </div>
      </FormGroup>
    </div>
  );
}

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

  const toggleReward = (opt: BreakdownReward, checked: boolean) => {
    setBreakdownRewards((prev) =>
      checked ? [...prev, opt] : prev.filter((x) => x !== opt),
    );
  };

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

      <nav className="rs-report-stepper" aria-label="Report sections">
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
          <>
            <ScaleField
              id="perf-temp"
              label="Game temperature"
              description="How emotional/physical the game felt overall. 1 = friendly/social vibe. 3 = competitive but manageable. 5 = very hot. (Match environment, not your performance.)"
              lowLabel="Calm"
              highLabel="Hot"
              value={gameTemperature}
              onChange={setGameTemperature}
            />
            <ScaleField
              id="perf-control"
              label="Control & flow"
              description="How well you set standards and kept the game moving. 1 = reactive. 3 = mixed. 5 = proactive: clear standards early, effective prevention."
              lowLabel="Reactive"
              highLabel="Proactive"
              value={controlAndFlow}
              onChange={setControlAndFlow}
            />
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
          </>
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
                Tick the things you consistently rewarded that shaped the
                contest.
              </p>
              {BREAKDOWN_REWARD_OPTIONS.map((opt) => (
                <Checkbox
                  key={opt}
                  id={`perf-bd-${opt}`}
                  label={opt}
                  isChecked={breakdownRewards.includes(opt)}
                  onChange={(_e, checked) => toggleReward(opt, checked)}
                />
              ))}
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
            <ScaleField
              id="perf-adv"
              label="Advantage use"
              description="How purposeful and outcome-focused your advantage was. 1 = rarely/unclearly played. 3 = sometimes played but outcomes unclear. 5 = clear signals, real gain, brought back promptly when no benefit."
              lowLabel="Rarely"
              highLabel="Clear"
              value={advantageUse}
              onChange={setAdvantageUse}
            />
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
