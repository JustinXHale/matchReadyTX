import { useMemo, useState } from 'react';
import { EmptyState, EmptyStateBody, Title } from '@patternfly/react-core';
import { Link } from 'react-router-dom';
import { useApp, useAppHref } from '@/app/AppContext';
import {
  COACH_FEEDBACK_SCALE_LABELS,
  appendCoachFeedbackEdit,
  coachFeedbackDocId,
  coachFeedbackNeedsAttention,
  existingCoachFeedback,
  formatMatchScore,
  isMatchEligibleForCoachFeedback,
  matchOfficialForFeedback,
  reportingTeamIdForUser,
  type CoachFeedback,
} from '@/domain/coachFeedback';
import { matchesForUser } from '@/domain/visibility';
import type { MatchGender, Team } from '@/domain/types';
import { GlobalDivisionFilters } from '@/features/global/GlobalDivisionFilters';
import {
  compareKickoffAsc,
  divisionFilterOptionsFromMatches,
  matchOnCalendarDate,
  uniqueMatchCalendarDates,
} from '@/domain/divisionFilters';
import { isFirebaseConfigured } from '@/services/firebase';
import { defaultOrgId, saveCoachFeedbackInFirestore } from '@/services/orgData';
import { MatchListRow } from '@/ui/MatchListRow';

type StatusFilter = 'all' | 'needs' | 'submitted' | 'declined' | 'draft';

function statusLabel(existing: CoachFeedback | undefined): string {
  if (!existing) return 'Leave feedback';
  if (existing.status === 'declined') return 'Declined';
  if (existing.status === 'draft') return 'Draft';
  const overall = existing.scales.overall;
  if (overall != null) {
    return `Submitted · ${COACH_FEEDBACK_SCALE_LABELS[overall]}`;
  }
  return 'Submitted';
}

export function TeamAdminReportPage() {
  const { currentUser, state, store, dataMode, refresh } = useApp();
  const reportBase = useAppHref('/team-admin/report');

  const [teamFilter, setTeamFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [genderFilter, setGenderFilter] = useState<MatchGender | null>(null);
  const [levelFilter, setLevelFilter] = useState<string | null>(null);
  const [competitionFilter, setCompetitionFilter] = useState<string | null>(
    null,
  );
  const [dateFilter, setDateFilter] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const myTeams = useMemo((): Team[] => {
    if (!currentUser) return [];
    return currentUser.teamIds
      .map((id) => state.teams.find((t) => t.id === id))
      .filter((t): t is Team => t != null);
  }, [currentUser, state.teams]);

  const rows = useMemo(() => {
    if (!currentUser) return [];
    const visible = matchesForUser(state.matches, currentUser, 'teamAdmin');
    return visible
      .filter((m) => isMatchEligibleForCoachFeedback(m, currentUser))
      .map((match) => {
        const reportingTeamId = reportingTeamIdForUser(match, currentUser)!;
        const existing = existingCoachFeedback(
          state.coachFeedback,
          match.id,
          reportingTeamId,
        );
        const mo = matchOfficialForFeedback(match);
        return { match, reportingTeamId, existing, mo };
      })
      .sort((a, b) => compareKickoffAsc(a.match, b.match));
  }, [currentUser, state.matches, state.coachFeedback]);

  const filterOptions = useMemo(
    () =>
      divisionFilterOptionsFromMatches(
        rows.map((r) => r.match),
        competitionFilter,
      ),
    [rows, competitionFilter],
  );

  const availableDates = useMemo(
    () =>
      uniqueMatchCalendarDates(
        rows
          .filter(({ match, reportingTeamId }) => {
            if (teamFilter && reportingTeamId !== teamFilter) return false;
            if (genderFilter && match.gender !== genderFilter) return false;
            if (levelFilter && match.level !== levelFilter) return false;
            if (competitionFilter && match.competition !== competitionFilter) {
              return false;
            }
            return true;
          })
          .map((r) => r.match),
      ),
    [rows, teamFilter, genderFilter, levelFilter, competitionFilter],
  );

  const filtered = useMemo(() => {
    return rows.filter(({ match, reportingTeamId, existing }) => {
      if (teamFilter && reportingTeamId !== teamFilter) return false;
      if (genderFilter && match.gender !== genderFilter) return false;
      if (levelFilter && match.level !== levelFilter) return false;
      if (competitionFilter && match.competition !== competitionFilter) {
        return false;
      }
      if (!matchOnCalendarDate(match, dateFilter)) return false;
      if (statusFilter === 'needs') {
        return coachFeedbackNeedsAttention(existing);
      }
      if (statusFilter === 'submitted') {
        return existing?.status === 'submitted';
      }
      if (statusFilter === 'declined') {
        return existing?.status === 'declined';
      }
      if (statusFilter === 'draft') {
        return existing?.status === 'draft';
      }
      return true;
    });
  }, [
    rows,
    teamFilter,
    statusFilter,
    genderFilter,
    levelFilter,
    competitionFilter,
    dateFilter,
  ]);

  const hasFilters =
    teamFilter != null ||
    statusFilter !== 'all' ||
    genderFilter != null ||
    levelFilter != null ||
    competitionFilter != null ||
    dateFilter != null;

  const onDecline = async (matchId: string, reportingTeamId: string) => {
    if (!currentUser) return;
    const match = state.matches.find((m) => m.id === matchId);
    if (!match) return;
    const mo = matchOfficialForFeedback(match);
    if (!mo) return;
    const reportingTeamName =
      reportingTeamId === match.homeTeamId
        ? match.homeTeamName
        : match.awayTeamName;
    const existing = existingCoachFeedback(
      state.coachFeedback,
      matchId,
      reportingTeamId,
    );
    if (existing?.status === 'submitted') return;

    const now = new Date().toISOString();
    const edit = {
      at: now,
      byUserId: currentUser.uid,
      byName: currentUser.displayName,
      action: 'decline' as const,
    };
    const feedback: CoachFeedback = {
      id: coachFeedbackDocId(matchId, reportingTeamId),
      orgId: dataMode === 'live' ? defaultOrgId() : state.org.id,
      matchId,
      slot: 'mo',
      officialUserId: mo.userId,
      officialName: mo.userName,
      homeTeamId: match.homeTeamId,
      homeTeamName: match.homeTeamName,
      awayTeamId: match.awayTeamId,
      awayTeamName: match.awayTeamName,
      kickoffAt: match.kickoffAt,
      competition: match.competition,
      level: match.level,
      score: formatMatchScore(match),
      scales: existing?.scales ?? {},
      commentsOnScores: existing?.commentsOnScores,
      areasDoneWell: existing?.areasDoneWell,
      areasToImprove: existing?.areasToImprove,
      otherFeedback: existing?.otherFeedback,
      videoLink: existing?.videoLink,
      videoNotes: existing?.videoNotes,
      otherCrewFeedback: existing?.otherCrewFeedback,
      submitterUserId: currentUser.uid,
      submitterName: currentUser.displayName,
      submitterEmail: currentUser.email,
      submitterPhone: existing?.submitterPhone ?? currentUser.phone,
      clubRole: existing?.clubRole ?? '',
      contactAboutReport: existing?.contactAboutReport === true,
      reportingTeamId,
      reportingTeamName,
      status: 'declined',
      submittedAt: existing?.submittedAt,
      edits: appendCoachFeedbackEdit(existing?.edits, edit),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    setBusyId(feedback.id);
    try {
      if (dataMode === 'live' && isFirebaseConfigured) {
        await saveCoachFeedbackInFirestore(defaultOrgId(), feedback);
        store.upsertCoachFeedbackLocal(feedback);
      } else {
        store.saveCoachFeedback(feedback);
      }
      refresh();
    } finally {
      setBusyId(null);
    }
  };

  if (!currentUser) return null;

  if (!currentUser.roles.includes('teamAdmin')) {
    return (
      <div className="rs-stack">
        <p className="rs-match-card__meta">Team Admin access required.</p>
      </div>
    );
  }

  return (
    <div className="rs-stack">
      <Title headingLevel="h1" size="lg">
        Referee feedback
      </Title>
      <p className="rs-match-card__meta">
        Optional reports on the Match Official after a game. Only the Scheduler
        reviews these — referees do not see them. Leaving feedback helps the
        society spot trends and coaching needs. Home and away sides each leave
        their own report.
      </p>

      {myTeams.length > 1 && (
        <div className="rs-filter-chips" role="group" aria-label="Filter by side">
          {myTeams.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`rs-filter-chip${
                teamFilter === t.id ? ' rs-filter-chip--selected' : ''
              }`}
              aria-pressed={teamFilter === t.id}
              onClick={() =>
                setTeamFilter((prev) => (prev === t.id ? null : t.id))
              }
            >
              {t.name}
            </button>
          ))}
        </div>
      )}

      <div
        className="rs-filter-chips"
        role="group"
        aria-label="Filter by feedback status"
      >
        {(
          [
            { id: 'all', label: 'All' },
            { id: 'needs', label: 'Needs feedback' },
            { id: 'draft', label: 'Draft' },
            { id: 'submitted', label: 'Submitted' },
            { id: 'declined', label: 'Declined' },
          ] as const
        ).map((f) => (
          <button
            key={f.id}
            type="button"
            className={`rs-filter-chip${
              statusFilter === f.id ? ' rs-filter-chip--selected' : ''
            }`}
            aria-pressed={statusFilter === f.id}
            onClick={() => setStatusFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <GlobalDivisionFilters
        options={filterOptions}
        genderFilter={genderFilter}
        levelFilter={levelFilter}
        competitionFilter={competitionFilter}
        onGenderChange={setGenderFilter}
        onLevelChange={setLevelFilter}
        onCompetitionChange={setCompetitionFilter}
        showDate
        dateFilter={dateFilter}
        onDateChange={setDateFilter}
        availableDates={availableDates}
        ariaLabel="Filter by division"
      />

      {filtered.length === 0 ? (
        rows.length === 0 ? (
          <EmptyState titleText="No games to report yet" headingLevel="h3">
            <EmptyStateBody>
              After a past match with a confirmed Match Official, it will show
              up here for optional feedback.
            </EmptyStateBody>
          </EmptyState>
        ) : (
          <p className="rs-match-card__meta">
            {hasFilters
              ? 'No games match these filters. Tap a chip again to clear it.'
              : 'No games to show.'}
          </p>
        )
      ) : (
        <div className="rs-stack">
          {filtered.map(({ match, reportingTeamId, existing, mo }) => {
            const needs = coachFeedbackNeedsAttention(existing);
            const canDecline =
              existing?.status !== 'submitted' && existing?.status !== 'declined';
            const formHref = `${reportBase}/${match.id}`;
            return (
              <MatchListRow
                key={`${match.id}_${reportingTeamId}`}
                match={match}
                to={formHref}
                split="action"
                warn={needs}
                trailing={
                  <div className="rs-coach-feedback-trailing">
                    <Link
                      to={formHref}
                      className="rs-coach-feedback-trailing__hit"
                    >
                      <span
                        className={`rs-pill${needs ? ' rs-pill--warn' : ''}`}
                      >
                        {statusLabel(existing)}
                      </span>
                      {mo ? (
                        <span className="rs-coach-feedback-trailing__mo">
                          MO {mo.userName}
                        </span>
                      ) : null}
                    </Link>
                    {canDecline ? (
                      <button
                        type="button"
                        className="rs-coach-feedback-decline"
                        disabled={
                          busyId ===
                          coachFeedbackDocId(match.id, reportingTeamId)
                        }
                        onClick={() =>
                          void onDecline(match.id, reportingTeamId)
                        }
                      >
                        Decline
                      </button>
                    ) : null}
                  </div>
                }
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
