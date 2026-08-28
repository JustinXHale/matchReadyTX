import type { ReactNode } from 'react';
import { Title } from '@patternfly/react-core';
import {
  BREAKDOWN_REWARD_OPTIONS,
  MATCH_FEEDBACK_LABEL,
  type MoReportPayload,
} from '@/domain/reports';
import type { Match } from '@/domain/types';

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

function ScaleValue({ value }: { value?: number }) {
  if (value == null) return null;
  return <span>{value}/5</span>;
}

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rs-report-view__section">
      <Title headingLevel="h3" size="md" className="rs-perf-report__title">
        {title}
      </Title>
      {children}
    </section>
  );
}

function TeamScoreReadout({
  side,
  teamName,
  points,
  yellow,
  red,
}: {
  side: 'Home' | 'Away';
  teamName: string;
  points: number;
  yellow?: number;
  red?: number;
}) {
  return (
    <div className="rs-team-score-card rs-team-score-card--readonly">
      <div className="rs-team-score-card__head">
        <span className="rs-pill rs-pill--ink">{side}</span>
        <strong>{teamName}</strong>
      </div>
      <p className="rs-match-card__meta">
        {points} pts · YC {yellow ?? 0} · RC {red ?? 0}
      </p>
    </div>
  );
}

export function SubmittedPerformanceReportView({
  mo,
  match,
}: {
  mo: MoReportPayload;
  match?: Match;
}) {
  const homeName = mo.homeTeamName ?? match?.homeTeamName ?? 'Home';
  const awayName = mo.awayTeamName ?? match?.awayTeamName ?? 'Away';
  const breakdownSet = new Set(mo.breakdownRewards ?? []);

  return (
    <div className="rs-stack rs-perf-report rs-perf-report--readonly">
      <Section title="Match details">
        <Field label="Referee">{mo.refereeName}</Field>
        <Field label="Match date">{mo.matchDate}</Field>
        <Field label="Format">{mo.format}</Field>
        <Field label="Division">{mo.division}</Field>
        <div className="rs-form-grid-2">
          <TeamScoreReadout
            side="Home"
            teamName={homeName}
            points={mo.homePoints}
            yellow={mo.homeYellowCards}
            red={mo.homeRedCards}
          />
          <TeamScoreReadout
            side="Away"
            teamName={awayName}
            points={mo.awayPoints}
            yellow={mo.awayYellowCards}
            red={mo.awayRedCards}
          />
        </div>
        <Field label="Referee team">{mo.refereeTeamNote}</Field>
      </Section>

      <Section title="Snapshot">
        <Field label="Game temperature">
          <ScaleValue value={mo.gameTemperature} />
        </Field>
        <Field label="Control & flow">
          <ScaleValue value={mo.controlAndFlow} />
        </Field>
        <Field label="Today I performed…">{mo.todayIPerformed}</Field>
      </Section>

      <Section title="Reflection">
        <Field label="Type of moment">{mo.typeOfMoment}</Field>
        <Field label="What did you decide and why?">
          {mo.decidedAndWhy}
        </Field>
        {breakdownSet.size > 0 && (
          <Field label="Breakdown: what did you reward most?">
            <div className="rs-cmo-select-cards rs-cmo-select-cards--readonly">
              {BREAKDOWN_REWARD_OPTIONS.map((opt) => (
                <div
                  key={opt}
                  className={`rs-cmo-select-cards__card${
                    breakdownSet.has(opt)
                      ? ' rs-cmo-select-cards__card--selected'
                      : ''
                  }`}
                >
                  {opt}
                </div>
              ))}
            </div>
          </Field>
        )}
        <Field label="Set piece: biggest challenge today">
          {mo.setPieceChallenge}
        </Field>
        <Field label="Advantage use">
          <ScaleValue value={mo.advantageUse} />
        </Field>
      </Section>

      <Section title="Closing">
        <Field label="Problems (not card reports)">{mo.nonCardProblems}</Field>
        <Field label={MATCH_FEEDBACK_LABEL}>{mo.lightFeedback}</Field>
        <Field label="Other comments / link">{mo.otherCommentsOrLink}</Field>
      </Section>
    </div>
  );
}
