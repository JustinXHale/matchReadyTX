import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Button,
  FormGroup,
  FormSelect,
  FormSelectOption,
  Modal,
  ModalHeader,
  TextArea,
  TextInput,
  Title,
} from '@patternfly/react-core';
import { EllipsisVIcon } from '@patternfly/react-icons';
import { useApp, useAppHref } from '@/app/AppContext';
import { useAppFeedback } from '@/app/feedback/feedbackContext';
import {
  CARD_LAW_LABELS,
  isCardLawId,
  isPlayerPosition,
  PLAYER_POSITION_LABELS,
} from '@/domain/cardLaws';
import {
  effectiveContactEmail,
  isApplePrivateRelayEmail,
} from '@/domain/contactEmail';
import {
  CARD_CONFERENCE_LABELS,
  cardCompetitionDisplayLabel,
} from '@/domain/reports';
import {
  casePlayerNameFromParts,
  displayCasePlayer,
  JUDICIAL_CASE_STATUS_LABELS,
  isHearingColor,
  judicialCasesQuery,
  rulingNeedsSanction,
  type JudicialCase,
  type JudicialCaseStatus,
  type JudicialComment,
} from '@/domain/judicial';
import { useContextualAppBack } from '@/app/shell/contextualBar';
import {
  addJudicialCommentInFirestore,
  callDeleteJudicialCase,
  callableErrorMessage,
  defaultOrgId,
  saveJudicialCaseInFirestore,
  subscribeJudicialComments,
} from '@/services/orgData';
import { MatchListRow } from '@/ui/MatchListRow';

const HEARING_STATUSES: JudicialCaseStatus[] = [
  'pending',
  'upheld',
  'dismissed',
  'reduced',
  'summary_judgment',
];

function cardColorLabel(color: JudicialCase['color']): string {
  if (color === 'yellow') return 'Yellow';
  if (color === 'second_yellow_red') return '2nd Yellow–Red';
  return 'Red';
}

export function JudicialCaseDetailPage() {
  const { incidentId = '' } = useParams();
  const { state, currentUser, dataMode, store } = useApp();
  const { confirm } = useAppFeedback();
  const navigate = useNavigate();
  const casesHref = useAppHref('/judicial/cases');
  useContextualAppBack({
    to: '/judicial/cases',
    label: 'Cases',
  });

  const judicialCase = state.judicialCases.find((c) => c.id === incidentId);
  const report = judicialCase
    ? state.cardReports.find((r) => r.id === judicialCase.reportId)
    : undefined;
  const match = judicialCase
    ? state.matches.find((m) => m.id === judicialCase.matchId)
    : undefined;
  const officialUser = report
    ? state.users.find((u) => u.uid === report.officialId)
    : undefined;

  const [status, setStatus] = useState<JudicialCaseStatus>(
    judicialCase?.status ?? 'pending',
  );
  const [sanctionMatches, setSanctionMatches] = useState(
    judicialCase?.sanctionMatches != null
      ? String(judicialCase.sanctionMatches)
      : '',
  );
  const [sanctionNote, setSanctionNote] = useState(
    judicialCase?.sanctionNote ?? '',
  );
  const [commentBody, setCommentBody] = useState('');
  const [playerFirst, setPlayerFirst] = useState('');
  const [playerLast, setPlayerLast] = useState('');
  const [playerJersey, setPlayerJersey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [identityError, setIdentityError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [liveComments, setLiveComments] = useState<JudicialComment[] | null>(
    null,
  );

  useEffect(() => {
    if (!judicialCase) return;
    setStatus(judicialCase.status);
    setSanctionMatches(
      judicialCase.sanctionMatches != null
        ? String(judicialCase.sanctionMatches)
        : '',
    );
    setSanctionNote(judicialCase.sanctionNote ?? '');
    setPlayerFirst(judicialCase.playerFirstName);
    setPlayerLast(judicialCase.playerLastName);
    setPlayerJersey(judicialCase.playerJersey ?? '');
  }, [judicialCase]);

  useEffect(() => {
    if (dataMode !== 'live' || !incidentId) return;
    return subscribeJudicialComments(
      defaultOrgId(),
      incidentId,
      (comments) => {
        store.setJudicialComments(incidentId, comments);
        setLiveComments(comments);
      },
      (err) => console.error('Judicial comments failed', err),
    );
  }, [dataMode, incidentId, store]);

  const comments = liveComments ?? state.judicialComments[incidentId] ?? [];
  const incident = useMemo(() => {
    if (!report || !judicialCase) return undefined;
    return report.cards.find((c) => c.id === judicialCase.incidentId);
  }, [report, judicialCase]);

  /** Prefer profile contact email over Apple Hide My Email relay. */
  const officialEmailDisplay = useMemo(() => {
    if (!report) return '';
    if (officialUser) {
      const contact = effectiveContactEmail(officialUser).trim();
      const stored = report.officialEmail?.trim() ?? '';
      if (contact && !isApplePrivateRelayEmail(contact)) return contact;
      if (
        isApplePrivateRelayEmail(stored) &&
        officialUser.contactEmail?.trim()
      ) {
        return officialUser.contactEmail.trim();
      }
      if (contact) return contact;
    }
    return report.officialEmail?.trim() ?? '';
  }, [report, officialUser]);

  if (!currentUser) return null;

  if (!judicialCase) {
    return (
      <div className="rs-stack">
        <Title headingLevel="h2" size="lg">
          Case not found
        </Title>
      </div>
    );
  }

  const saveRuling = async () => {
    if (
      rulingNeedsSanction(status) &&
      !sanctionMatches.trim() &&
      !sanctionNote.trim()
    ) {
      setError('Add a match ban count or a note (e.g. time served).');
      return;
    }
    const nowIso = new Date().toISOString();
    const next: JudicialCase = {
      ...judicialCase,
      status,
      sanctionMatches: sanctionMatches.trim()
        ? Number(sanctionMatches)
        : undefined,
      sanctionNote: sanctionNote.trim() || undefined,
      ruledAt: nowIso,
      ruledByUid: currentUser.uid,
      ruledByName: currentUser.displayName,
      updatedAt: nowIso,
    };
    setError(null);
    store.upsertJudicialCase(next);
    if (dataMode === 'live') {
      await saveJudicialCaseInFirestore(defaultOrgId(), next);
    }
  };

  const saveIdentity = async () => {
    const jersey = playerJersey.trim();
    const parts = casePlayerNameFromParts(playerFirst, playerLast, jersey);
    if (!parts.playerName && !jersey) {
      setIdentityError('Add a player name or jersey number.');
      return;
    }
    const previousName = displayCasePlayer(judicialCase);
    const nowIso = new Date().toISOString();
    const next: JudicialCase = {
      ...judicialCase,
      ...parts,
      playerJersey: jersey || undefined,
      updatedAt: nowIso,
    };
    setIdentityError(null);
    store.upsertJudicialCase(next);
    if (dataMode === 'live') {
      await saveJudicialCaseInFirestore(defaultOrgId(), next);
    }
    const nextLabel = displayCasePlayer(next);
    if (previousName !== nextLabel) {
      const comment: JudicialComment = {
        id: `jc_${Math.random().toString(36).slice(2, 10)}`,
        authorUid: currentUser.uid,
        authorName: currentUser.displayName,
        body: `Player identity updated: ${previousName} → ${nextLabel}`,
        createdAt: nowIso,
      };
      store.addJudicialComment(judicialCase.id, comment);
      if (dataMode === 'live') {
        await addJudicialCommentInFirestore(
          defaultOrgId(),
          judicialCase.id,
          comment,
        );
      }
    }
  };

  const canTracePlayer = Boolean(
    judicialCase.playerFirstName.trim() ||
      judicialCase.playerLastName.trim() ||
      (judicialCase.playerName.trim() &&
        !judicialCase.playerName.startsWith('#')),
  );
  const traceHref = `${casesHref}${judicialCasesQuery({
    school: judicialCase.teamName,
    player: judicialCase.playerName,
  })}`;

  const addComment = async () => {
    const body = commentBody.trim();
    if (!body) return;
    const comment: JudicialComment = {
      id: `jc_${Math.random().toString(36).slice(2, 10)}`,
      authorUid: currentUser.uid,
      authorName: currentUser.displayName,
      body,
      createdAt: new Date().toISOString(),
    };
    store.addJudicialComment(judicialCase.id, comment);
    setCommentBody('');
    if (dataMode === 'live') {
      await addJudicialCommentInFirestore(
        defaultOrgId(),
        judicialCase.id,
        comment,
      );
    }
  };

  const deleteCase = async () => {
    setActionsOpen(false);
    const confirmed = await confirm({
      title: 'Delete this case?',
      message:
        'This permanently deletes the judicial case and its comments from Firebase. This cannot be undone. Use this for duplicate cases only.',
      confirmLabel: 'Delete case',
      destructive: true,
    });
    if (!confirmed) return;
    setDeleteError(null);
    setDeleting(true);
    try {
      if (dataMode === 'live') {
        await callDeleteJudicialCase({ caseId: judicialCase.id });
      }
      store.removeJudicialCase(judicialCase.id);
      navigate(casesHref, { replace: true });
    } catch (err) {
      setDeleteError(callableErrorMessage(err, 'Could not delete case.'));
    } finally {
      setDeleting(false);
    }
  };

  const positionLabel =
    incident?.playerPosition && isPlayerPosition(incident.playerPosition)
      ? PLAYER_POSITION_LABELS[incident.playerPosition]
      : undefined;

  return (
    <div className="rs-stack rs-judicial-case rs-judicial-case--has-mobile-action">
      <header className="rs-judicial-case__header">
        <Title headingLevel="h1" size="lg">
          {displayCasePlayer(judicialCase)}
        </Title>
        <p className="rs-match-card__meta">
          {judicialCase.teamName}
          {' · '}
          {cardColorLabel(judicialCase.color)}
          {judicialCase.conference
            ? ` · ${CARD_CONFERENCE_LABELS[judicialCase.conference]}`
            : ''}
          {positionLabel ? ` · ${positionLabel}` : ''}
          {judicialCase.playerJersey
            ? ` · #${judicialCase.playerJersey}`
            : ''}
        </p>
      </header>

      {/* Match context — event-card style, no player re-listing */}
      <section className="rs-detail-card rs-judicial-case__match">
        <h2 className="rs-detail-section__label">Match</h2>
        {match ? (
          <MatchListRow match={match} showTime />
        ) : (
          <p className="rs-match-card__meta">
            {judicialCase.matchDate
              ? `Match date ${judicialCase.matchDate}`
              : 'Match details unavailable'}
          </p>
        )}
        <dl className="rs-judicial-case__facts">
          {(report?.officialName || judicialCase.officialName) && (
            <div className="rs-judicial-case__fact">
              <dt>Match official</dt>
              <dd>
                {report?.officialName || judicialCase.officialName}
                {officialEmailDisplay ? ` · ${officialEmailDisplay}` : ''}
                {report?.officialPhone ? ` · ${report.officialPhone}` : ''}
              </dd>
            </div>
          )}
          {report?.competitionUnion && (
            <div className="rs-judicial-case__fact">
              <dt>Competition</dt>
              <dd>
                {cardCompetitionDisplayLabel(
                  report.competitionUnion,
                  report.conference,
                )}
              </dd>
            </div>
          )}
          {report?.matchFilmed != null && (
            <div className="rs-judicial-case__fact">
              <dt>Filmed</dt>
              <dd>{report.matchFilmed ? 'Yes' : 'No'}</dd>
            </div>
          )}
          {(report?.homeScore != null || report?.awayScore != null) && (
            <div className="rs-judicial-case__fact">
              <dt>Score</dt>
              <dd>
                {report?.homeScore ?? '—'}–{report?.awayScore ?? '—'}
              </dd>
            </div>
          )}
          {!match && judicialCase.matchDate && (
            <div className="rs-judicial-case__fact">
              <dt>Match date</dt>
              <dd>{judicialCase.matchDate}</dd>
            </div>
          )}
        </dl>
      </section>

      {/* Incident write-up — time, narrative, law */}
      <section className="rs-detail-card rs-judicial-case__incident">
        <h2 className="rs-detail-section__label">Incident</h2>
        <dl className="rs-judicial-case__facts">
          <div className="rs-judicial-case__fact">
            <dt>Time</dt>
            <dd>
              {incident?.minute?.trim() ||
                (judicialCase.color === 'yellow' ? 'Yellow card' : '—')}
            </dd>
          </div>
        </dl>
        <p className="rs-judicial-case__summary">
          {incident?.offenseSummary ||
            incident?.reason ||
            judicialCase.offenseSummary ||
            'No write-up on file.'}
        </p>
        {(incident?.lawIds ?? judicialCase.lawIds ?? []).length > 0 && (
          <div className="rs-judicial-case__laws">
            <h3 className="rs-judicial-case__laws-label">Infringement</h3>
            <ul>
              {(incident?.lawIds ?? judicialCase.lawIds ?? [])
                .filter(isCardLawId)
                .map((id) => (
                  <li key={id}>{CARD_LAW_LABELS[id]}</li>
                ))}
            </ul>
          </div>
        )}
        {report?.additionalInfoPrivate && (
          <p className="rs-match-card__meta">
            Scheduler notes: {report.additionalInfoPrivate}
          </p>
        )}
      </section>

      <section className="rs-detail-card">
        <h2 className="rs-detail-section__label">Player identity</h2>
        <p className="rs-match-card__meta">
          Correct the name when the referee only knew the jersey. Team:{' '}
          {judicialCase.teamName}
        </p>
        <FormGroup label="First name">
          <TextInput
            value={playerFirst}
            onChange={(_e, v) => setPlayerFirst(v)}
          />
        </FormGroup>
        <FormGroup label="Last name">
          <TextInput
            value={playerLast}
            onChange={(_e, v) => setPlayerLast(v)}
          />
        </FormGroup>
        <FormGroup label="Jersey number">
          <TextInput
            value={playerJersey}
            onChange={(_e, v) => setPlayerJersey(v)}
          />
        </FormGroup>
        {identityError && (
          <p className="rs-match-card__meta" role="alert">
            {identityError}
          </p>
        )}
        <Button variant="primary" onClick={() => void saveIdentity()}>
          Save identity
        </Button>
        {canTracePlayer && (
          <p className="rs-match-card__meta">
            <Link to={traceHref}>All cases for this player</Link>
          </p>
        )}
      </section>

      <section className="rs-detail-card">
        <h2 className="rs-detail-section__label">Ruling</h2>
        <FormGroup label="Outcome" isRequired>
          <FormSelect
            value={status}
            onChange={(_e, v) => setStatus(v as JudicialCaseStatus)}
            aria-label="Ruling"
          >
            {(isHearingColor(judicialCase.color)
              ? HEARING_STATUSES
              : (Object.keys(
                  JUDICIAL_CASE_STATUS_LABELS,
                ) as JudicialCaseStatus[])
            ).map((k) => (
              <FormSelectOption
                key={k}
                value={k}
                label={JUDICIAL_CASE_STATUS_LABELS[k]}
              />
            ))}
          </FormSelect>
        </FormGroup>
        <FormGroup label="Match suspension">
          <TextInput
            type="number"
            value={sanctionMatches}
            onChange={(_e, v) => setSanctionMatches(v)}
          />
        </FormGroup>
        <FormGroup label="Note">
          <TextInput
            value={sanctionNote}
            onChange={(_e, v) => setSanctionNote(v)}
            placeholder="e.g. Time served"
          />
        </FormGroup>
        {error && (
          <p className="rs-match-card__meta" role="alert">
            {error}
          </p>
        )}
        <Button variant="primary" onClick={() => void saveRuling()}>
          Save ruling
        </Button>
      </section>

      <section className="rs-detail-card">
        <h2 className="rs-detail-section__label">Comments</h2>
        {comments.length === 0 ? (
          <p className="rs-match-card__meta">No comments yet.</p>
        ) : (
          comments.map((c) => (
            <div key={c.id} className="rs-judicial-comment">
              <p className="rs-judicial-comment__meta">
                {c.authorName} · {new Date(c.createdAt).toLocaleString()}
              </p>
              <p>{c.body}</p>
            </div>
          ))
        )}
        <FormGroup label="Add a comment" fieldId="jc-body">
          <TextArea
            id="jc-body"
            value={commentBody}
            onChange={(_e, v) => setCommentBody(v)}
            rows={3}
          />
        </FormGroup>
        <Button variant="secondary" onClick={() => void addComment()}>
          Post comment
        </Button>
      </section>

      {deleteError && (
        <p className="rs-match-card__meta" role="alert">
          {deleteError}
        </p>
      )}

      <div className="rs-judicial-case__mobile-action-bar">
        <button
          type="button"
          className="rs-judicial-case__bar-toggle"
          aria-label="Case actions"
          aria-haspopup="dialog"
          aria-expanded={actionsOpen}
          disabled={deleting}
          onClick={() => setActionsOpen(true)}
        >
          <span className="rs-judicial-case__bar-toggle-content">
            <EllipsisVIcon aria-hidden />
            <span>Case actions</span>
          </span>
        </button>
        <Modal
          className="rs-match-actions-sheet"
          isOpen={actionsOpen}
          onClose={() => setActionsOpen(false)}
          aria-labelledby="judicial-case-actions-title"
        >
          <ModalHeader
            title="Case actions"
            labelId="judicial-case-actions-title"
            onClose={() => setActionsOpen(false)}
          />
          <div
            className="rs-match-actions-sheet__actions"
            role="group"
            aria-label="Case actions"
          >
            <button
              type="button"
              className="rs-match-actions-sheet__action rs-match-actions-sheet__action--danger"
              disabled={deleting}
              onClick={() => void deleteCase()}
            >
              Delete case
            </button>
          </div>
        </Modal>
      </div>

      {/* Desktop: explicit delete control (bar is mobile-only) */}
      <div className="rs-judicial-case__desktop-delete">
        <Button
          variant="danger"
          className="rs-btn--danger"
          isDisabled={deleting}
          isLoading={deleting}
          onClick={() => void deleteCase()}
        >
          Delete case
        </Button>
      </div>
    </div>
  );
}
