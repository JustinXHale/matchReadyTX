import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, FormSelect, FormSelectOption, Title } from '@patternfly/react-core';
import { useApp, useAppHref } from '@/app/AppContext';
import { CARD_CONFERENCE_LABELS } from '@/domain/reports';
import {
  disciplineDashboardStats,
  filterJudicialCases,
  displayCasePlayer,
  hearingOutcomeLabel,
  rugbySeasonLabel,
} from '@/domain/judicial';
import { InsightsHorizontalBars } from '@/features/insights/InsightsCharts';
import {
  InsightsStatCard,
  JudicialDonutHero,
  JudicialStackedBars,
} from '@/features/judicial/JudicialCharts';
import { useJudicialSeasonParams } from '@/features/judicial/judicialFilters';
import { BrandLogo } from '@/ui/BrandLogo';
import { RsDateField } from '@/ui/RsDateField';

const TOP_N = 5;

function schoolBarItems(
  schools: ReturnType<typeof disciplineDashboardStats>['bySchool'],
  casesBase: string,
  withSeason: ReturnType<typeof useJudicialSeasonParams>['withSeason'],
) {
  return schools.map((s) => ({
    key: s.teamId || s.teamName,
    label: s.teamName,
    yellow: s.yellowCount,
    red: s.redCount,
    href: `${casesBase}${withSeason({ school: s.teamName })}`,
    hrefYellow: `${casesBase}${withSeason({
      school: s.teamName,
      color: 'yellow',
    })}`,
    hrefRed: `${casesBase}${withSeason({
      school: s.teamName,
      color: 'red',
    })}`,
  }));
}

function officialBarItems(
  officials: ReturnType<typeof disciplineDashboardStats>['byOfficial'],
  casesBase: string,
  withSeason: ReturnType<typeof useJudicialSeasonParams>['withSeason'],
) {
  return officials.map((o) => ({
    key: o.officialId || o.officialName,
    label: o.officialName,
    yellow: o.yellowCount,
    red: o.redCount,
    href: `${casesBase}${withSeason({
      official: o.officialId || o.officialName,
    })}`,
    hrefYellow: `${casesBase}${withSeason({
      official: o.officialId || o.officialName,
      color: 'yellow',
    })}`,
    hrefRed: `${casesBase}${withSeason({
      official: o.officialId || o.officialName,
      color: 'red',
    })}`,
  }));
}

function playerBarItems(
  players: ReturnType<typeof disciplineDashboardStats>['byPlayer'],
  casesBase: string,
  withSeason: ReturnType<typeof useJudicialSeasonParams>['withSeason'],
) {
  return players.map((p) => ({
    key: p.traceKey,
    label: p.displayLabel,
    yellow: p.yellowCount,
    red: p.redCount,
    href: `${casesBase}${withSeason({
      school: p.teamName,
      player: p.playerName,
    })}`,
    hrefYellow: `${casesBase}${withSeason({
      school: p.teamName,
      player: p.playerName,
      color: 'yellow',
    })}`,
    hrefRed: `${casesBase}${withSeason({
      school: p.teamName,
      player: p.playerName,
      color: 'red',
    })}`,
  }));
}

export function JudicialDashboardPage() {
  const { state } = useApp();
  const casesBase = useAppHref('/judicial/cases');
  const { conference, from, to, patch, withSeason } = useJudicialSeasonParams();
  const [schoolsExpanded, setSchoolsExpanded] = useState(false);
  const [officialsExpanded, setOfficialsExpanded] = useState(false);
  const [offendersExpanded, setOffendersExpanded] = useState(false);

  const filtered = useMemo(
    () =>
      filterJudicialCases(state.judicialCases, {
        conference,
        from,
        to,
      }),
    [state.judicialCases, conference, from, to],
  );
  const stats = useMemo(
    () => disciplineDashboardStats(filtered),
    [filtered],
  );
  const season = rugbySeasonLabel();
  const conferenceTitle =
    conference === 'all'
      ? 'Lone Star Men’s & Women’s Conference'
      : conference === 'lonestar_men'
        ? 'Lone Star Men’s Conference'
        : 'Lone Star Women’s Conference';

  const visibleSchools = schoolsExpanded
    ? stats.bySchool
    : stats.bySchool.slice(0, TOP_N);
  const visibleOfficials = officialsExpanded
    ? stats.byOfficial
    : stats.byOfficial.slice(0, TOP_N);
  const visibleOffenders = offendersExpanded
    ? stats.byPlayer
    : stats.byPlayer.slice(0, TOP_N);

  return (
    <div className="rs-stack rs-judicial-dashboard">
      <header className="rs-judicial-dashboard__header">
        <div className="rs-judicial-dashboard__brand">
          <BrandLogo width={48} height={48} />
          <div>
            <Title headingLevel="h1" size="lg">
              {season} {conferenceTitle}
            </Title>
            <p className="rs-judicial-dashboard__kicker">Discipline Dashboard</p>
          </div>
        </div>
      </header>

      <div className="rs-filter-bar">
        <div className="rs-filter-bar__row">
          <label className="rs-filter-field">
            <span className="rs-filter-field__label">Conference</span>
            <FormSelect
              value={conference}
              onChange={(_e, v) =>
                patch({ conference: v as typeof conference })
              }
              aria-label="Conference filter"
            >
              <FormSelectOption value="all" label="All" />
              <FormSelectOption
                value="lonestar_men"
                label={CARD_CONFERENCE_LABELS.lonestar_men}
              />
              <FormSelectOption
                value="lonestar_women"
                label={CARD_CONFERENCE_LABELS.lonestar_women}
              />
            </FormSelect>
          </label>
          <label className="rs-filter-field">
            <span className="rs-filter-field__label">From</span>
            <RsDateField
              value={from}
              aria-label="From date"
              onChange={(next) => patch({ from: next ?? '' })}
            />
          </label>
          <label className="rs-filter-field">
            <span className="rs-filter-field__label">To</span>
            <RsDateField
              value={to}
              aria-label="To date"
              onChange={(next) => patch({ to: next ?? '' })}
            />
          </label>
        </div>
        <p className="rs-match-card__meta">
          Tap a tile, bar segment, or name to open the caseload. Cases live under
          the Cases tab.
        </p>
      </div>

      <div className="rs-judicial-dashboard-row rs-judicial-dashboard-row--kpis">
        <JudicialDonutHero
          to={`${casesBase}${withSeason()}`}
          totalCards={stats.totalCards}
          yellowPct={stats.yellowPct}
        />
        <InsightsStatCard
          to={`${casesBase}${withSeason({ color: 'yellow' })}`}
          title="Yellow cards"
          count={stats.yellowCards}
          meta={`${stats.yellowPct}%`}
        />
        <InsightsStatCard
          to={`${casesBase}${withSeason({ color: 'red' })}`}
          title="Red cards"
          count={stats.redCards}
          meta={`${stats.redPct}%`}
        />
      </div>

      <div className="rs-judicial-dashboard-row rs-judicial-dashboard-row--kpis-secondary">
        <InsightsStatCard
          to={`${casesBase}${withSeason({ color: 'red', status: 'upheld' })}`}
          title="Red cards upheld"
          count={stats.redsUpheld}
          meta={`${stats.redUpheldPct}%`}
        />
        <InsightsStatCard
          to={`${casesBase}${withSeason({ color: 'red', status: 'dismissed' })}`}
          title="Red cards dismissed"
          count={stats.redsDismissed}
          meta={`${stats.redDismissedPct}%`}
        />
      </div>

      <div className="rs-judicial-dashboard-row rs-judicial-dashboard-row--2">
        <section className="rs-detail-card" aria-labelledby="by-school">
          <h2 id="by-school" className="rs-detail-section__label">
            Reports by school
          </h2>
          {visibleSchools.length === 0 ? (
            <p className="rs-match-card__meta">No cards yet.</p>
          ) : (
            <>
              <JudicialStackedBars
                ariaLabel={
                  schoolsExpanded
                    ? 'All schools by card count'
                    : 'Top schools by card count'
                }
                items={schoolBarItems(visibleSchools, casesBase, withSeason)}
              />
              {stats.bySchool.length > TOP_N && (
                <p className="rs-match-card__meta">
                  {schoolsExpanded ? (
                    <>
                      Showing all {stats.bySchool.length} schools.{' '}
                      <Button
                        variant="link"
                        isInline
                        onClick={() => setSchoolsExpanded(false)}
                      >
                        Show top {TOP_N}
                      </Button>
                    </>
                  ) : (
                    <>
                      Showing top {TOP_N} of {stats.bySchool.length} schools.{' '}
                      <Button
                        variant="link"
                        isInline
                        onClick={() => setSchoolsExpanded(true)}
                      >
                        Show all {stats.bySchool.length} schools
                      </Button>
                    </>
                  )}
                </p>
              )}
            </>
          )}
        </section>
        <section className="rs-detail-card" aria-labelledby="by-official">
          <h2 id="by-official" className="rs-detail-section__label">
            Cards by match official
          </h2>
          {visibleOfficials.length === 0 ? (
            <p className="rs-match-card__meta">No issuing officials yet.</p>
          ) : (
            <>
              <JudicialStackedBars
                ariaLabel={
                  officialsExpanded
                    ? 'All match officials by card count'
                    : 'Top match officials by card count'
                }
                items={officialBarItems(visibleOfficials, casesBase, withSeason)}
              />
              {stats.byOfficial.length > TOP_N && (
                <p className="rs-match-card__meta">
                  {officialsExpanded ? (
                    <>
                      Showing all {stats.byOfficial.length} officials.{' '}
                      <Button
                        variant="link"
                        isInline
                        onClick={() => setOfficialsExpanded(false)}
                      >
                        Show top {TOP_N}
                      </Button>
                    </>
                  ) : (
                    <>
                      Showing top {TOP_N} of {stats.byOfficial.length} officials.{' '}
                      <Button
                        variant="link"
                        isInline
                        onClick={() => setOfficialsExpanded(true)}
                      >
                        Show all {stats.byOfficial.length} officials
                      </Button>
                    </>
                  )}
                </p>
              )}
            </>
          )}
        </section>
      </div>

      <div className="rs-judicial-dashboard-row rs-judicial-dashboard-row--2">
        <section className="rs-detail-card" aria-labelledby="trends">
          <h2 id="trends" className="rs-detail-section__label">
            Disciplinary trends
          </h2>
          {stats.byTrend.length === 0 ? (
            <p className="rs-match-card__meta">No law categories yet.</p>
          ) : (
            <InsightsHorizontalBars
              ariaLabel="Cards by infraction type"
              valueLabel="percent"
              items={stats.byTrend.map((t) => ({
                key: t.bucket,
                label: t.label,
                value: t.pct,
                meta: `${t.count}`,
                href: `${casesBase}${withSeason({ bucket: t.bucket })}`,
              }))}
            />
          )}
        </section>
        <section className="rs-detail-card" aria-labelledby="card-offenders">
          <h2 id="card-offenders" className="rs-detail-section__label">
            Card offenders
          </h2>
          {visibleOffenders.length === 0 ? (
            <p className="rs-match-card__meta">No players with cards yet.</p>
          ) : (
            <>
              <JudicialStackedBars
                ariaLabel={
                  offendersExpanded
                    ? 'All players by card count'
                    : 'Top players by card count'
                }
                items={playerBarItems(visibleOffenders, casesBase, withSeason)}
              />
              {stats.byPlayer.length > TOP_N && (
                <p className="rs-match-card__meta">
                  {offendersExpanded ? (
                    <>
                      Showing all {stats.byPlayer.length} players.{' '}
                      <Button
                        variant="link"
                        isInline
                        onClick={() => setOffendersExpanded(false)}
                      >
                        Show top {TOP_N}
                      </Button>
                    </>
                  ) : (
                    <>
                      Showing top {TOP_N} of {stats.byPlayer.length} players.{' '}
                      <Button
                        variant="link"
                        isInline
                        onClick={() => setOffendersExpanded(true)}
                      >
                        Show all {stats.byPlayer.length} players
                      </Button>
                    </>
                  )}
                </p>
              )}
            </>
          )}
        </section>
      </div>

      <section
        className="rs-detail-card rs-judicial-outcomes"
        aria-labelledby="red-outcomes"
      >
        <h2 id="red-outcomes" className="rs-detail-section__label">
          Red card review outcomes
        </h2>
        <div className="rs-judicial-outcomes-col">
          <strong>Dismissed ({stats.dismissedReds.length})</strong>
          {stats.dismissedReds.length === 0 ? (
            <p className="rs-match-card__meta">None yet.</p>
          ) : (
            <ul>
              {stats.dismissedReds.map((c) => (
                <li key={c.id}>
                  <Link to={`${casesBase}/${c.id}`}>
                    {displayCasePlayer(c)} ({c.teamName})
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rs-judicial-outcomes-col">
          <strong>Upheld ({stats.upheldReds.length})</strong>
          {stats.upheldReds.length === 0 ? (
            <p className="rs-match-card__meta">None yet.</p>
          ) : (
            <ul>
              {stats.upheldReds.map((c) => (
                <li key={c.id}>
                  <Link to={`${casesBase}/${c.id}`}>
                    {displayCasePlayer(c)} ({c.teamName}) — {hearingOutcomeLabel(c)}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rs-judicial-outcomes-col">
          <strong>Pending hearing ({stats.pendingReds.length})</strong>
          {stats.pendingReds.length === 0 ? (
            <p className="rs-match-card__meta">None awaiting review.</p>
          ) : (
            <ul>
              {stats.pendingReds.map((c) => (
                <li key={c.id}>
                  <Link to={`${casesBase}/${c.id}`}>
                    {displayCasePlayer(c)} ({c.teamName})
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
