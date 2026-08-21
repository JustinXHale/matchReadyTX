import { useMemo } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { EmptyState, EmptyStateBody, Title } from '@patternfly/react-core';
import { useApp } from '@/app/AppContext';
import { releasedMatches } from '@/domain/visibility';
import { genderLabel, type Match } from '@/domain/types';
import { MatchListRow } from '@/ui/MatchListRow';
import { MatchCrewTrailing } from '@/ui/MatchCrewTrailing';
import { formatTeamAddress, teamHomeMapsUrl } from '@/domain/teams';
import { readBackNav, type BackNav } from '@/nav/backNav';
import { MapsAddressLink } from '@/ui/MapsAddressLink';

function monthKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });
}

const FALLBACK_BACK: BackNav = { to: '/global/teams', label: 'Teams' };

export function GlobalTeamDetailPage() {
  const { teamId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, state } = useApp();
  const back = readBackNav(location.state) ?? FALLBACK_BACK;
  const goBack = () =>
    navigate(back.to, back.state !== undefined ? { state: back.state } : undefined);
  const backLabel = `Back to ${back.label}`;

  const team = useMemo(() => {
    if (!teamId) return null;
    const fromStore = state.teams.find((t) => t.id === teamId);
    if (fromStore) return fromStore;
    const sample = releasedMatches(state.matches).find(
      (m) => m.homeTeamId === teamId || m.awayTeamId === teamId,
    );
    if (!sample) return null;
    return {
      id: teamId,
      name:
        sample.homeTeamId === teamId
          ? sample.homeTeamName
          : sample.awayTeamName,
      contactEmails: [] as string[],
    };
  }, [teamId, state.teams, state.matches]);

  const matchBack: BackNav | undefined = team
    ? {
        to: `/global/teams/${team.id}`,
        label: team.name,
        state: location.state,
      }
    : undefined;

  const matches = useMemo(() => {
    if (!teamId) return [] as Match[];
    return releasedMatches(state.matches)
      .filter((m) => m.homeTeamId === teamId || m.awayTeamId === teamId)
      .sort(
        (a, b) =>
          new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime(),
      );
  }, [teamId, state.matches]);

  const byMonth = useMemo(() => {
    const groups: { key: string; label: string; matches: Match[] }[] = [];
    for (const m of matches) {
      const key = monthKey(m.kickoffAt);
      const last = groups[groups.length - 1];
      if (last && last.key === key) last.matches.push(m);
      else groups.push({ key, label: monthLabel(m.kickoffAt), matches: [m] });
    }
    return groups;
  }, [matches]);

  const divisionGenders = useMemo(() => {
    const genders = new Set<string>();
    for (const m of matches) genders.add(m.gender);
    return [...genders];
  }, [matches]);

  const address = team ? formatTeamAddress(team, matches) : '—';
  const mapsUrl = team ? teamHomeMapsUrl(team, matches) : null;

  if (!team) {
    return (
      <div className="rs-stack">
        <button
          type="button"
          className="rs-detail__back"
          onClick={goBack}
        >
          ← {backLabel}
        </button>
        <EmptyState titleText="Team not found" headingLevel="h3">
          <EmptyStateBody>
            That team isn’t on the schedule.
          </EmptyStateBody>
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="rs-stack">
      <button
        type="button"
        className="rs-detail__back"
        onClick={goBack}
      >
        ← {backLabel}
      </button>

      <Title headingLevel="h1" className="rs-team-detail__title">
        {team.name}
      </Title>
      {team.abbreviation?.trim() ? (
        <p className="rs-team-card__abbr">{team.abbreviation.trim()}</p>
      ) : null}

      <div className="rs-label-row" aria-label="Gender">
        {divisionGenders.map((g) => (
          <span key={g} className="rs-pill rs-pill--ink">
            {genderLabel(g as 'men' | 'women')}
          </span>
        ))}
      </div>
      {address !== '—' ? (
        <p className="rs-team-card__hint">
          <MapsAddressLink href={mapsUrl}>{address}</MapsAddressLink>
        </p>
      ) : null}

      {matches.length === 0 ? (
        <EmptyState titleText="No matches" headingLevel="h3">
          <EmptyStateBody>This team has no released games yet.</EmptyStateBody>
        </EmptyState>
      ) : (
        byMonth.map((group) => (
          <section key={group.key} className="rs-month-section">
            <Title headingLevel="h3" size="md" className="rs-month-heading">
              {group.label}
            </Title>
            <ul className="rs-list">
              {group.matches.map((m) => (
                  <li key={m.id}>
                    <MatchListRow
                      match={m}
                      to={`/matches/${m.id}`}
                      showTime
                      split="action"
                      back={matchBack}
                      trailing={
                        <MatchCrewTrailing
                          match={m}
                          highlightUserId={currentUser?.uid}
                          back={matchBack}
                        />
                      }
                    />
                  </li>
                ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
