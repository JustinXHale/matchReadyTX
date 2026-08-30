import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Button,
  FormGroup,
  FormSelect,
  FormSelectOption,
  TextArea,
  TextInput,
  Title,
} from '@patternfly/react-core';
import { useApp, useAppHref } from '@/app/AppContext';
import { CARD_LAW_LABELS, isCardLawId, isPlayerPosition, PLAYER_POSITION_LABELS } from '@/domain/cardLaws';
import {
  CARD_CONFERENCE_LABELS,
  COMPETITION_UNION_LABELS,
  displayPlayerName,
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
import { useAppBack } from '@/nav/backNav';
import {
  addJudicialCommentInFirestore,
  defaultOrgId,
  saveJudicialCaseInFirestore,
  subscribeJudicialComments,
} from '@/services/orgData';

const HEARING_STATUSES: JudicialCaseStatus[] = [
  'pending',
  'upheld',
  'dismissed',
  'reduced',
  'summary_judgment',
];

export function JudicialCaseDetailPage() {
  const { incidentId = '' } = useParams();
  const { state, currentUser, dataMode, store } = useApp();
  const navigate = useNavigate();
  const casesHref = useAppHref('/judicial/cases');
  const { goBack, backLabel } = useAppBack({
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
  }, [judicialCase?.id, judicialCase?.status, judicialCase?.updatedAt]);

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

  if (!currentUser) return null;

  if (!judicialCase) {
    return (
      <div className="rs-stack">
        <Title headingLevel="h2" size="lg">
          Case not found
        </Title>
        <Button variant="link" onClick={() => navigate(casesHref)}>
          Back to cases
        </Button>
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

  return (
    <div className="rs-stack">
      <button type="button" className="rs-detail__back" onClick={goBack}>
        ← {backLabel}
      </button>
      <Title headingLevel="h1" size="lg">
        {displayCasePlayer(judicialCase)}
      </Title>
      <p className="rs-match-card__meta">
        {judicialCase.teamName}
        {match
          ? ` · ${match.homeTeamName} vs ${match.awayTeamName}`
          : ''}
        {' · '}
        {judicialCase.color === 'yellow'
          ? 'Yellow'
          : judicialCase.color === 'second_yellow_red'
            ? '2nd Yellow–Red'
            : 'Red'}
        {judicialCase.conference
          ? ` · ${CARD_CONFERENCE_LABELS[judicialCase.conference]}`
          : ''}
        {judicialCase.officialName ? ` · MO ${judicialCase.officialName}` : ''}
        {judicialCase.matchDate ? ` · ${judicialCase.matchDate}` : ''}
      </p>

      {report && (
        <section className="rs-detail-card">
          <h2 className="rs-detail-section__label">Card report</h2>
          <p>
            Official: {report.officialName} · {report.officialEmail} ·{' '}
            {report.officialPhone}
          </p>
          <p>Match date: {report.matchDate}</p>
          {report.competitionUnion && (
            <p>{COMPETITION_UNION_LABELS[report.competitionUnion]}</p>
          )}
          {report.matchFilmed != null && (
            <p>Match filmed: {report.matchFilmed ? 'Yes' : 'No'}</p>
          )}
          {(report.homeScore != null || report.awayScore != null) && (
            <p>
              Score: {report.homeScore ?? '—'}–{report.awayScore ?? '—'}
            </p>
          )}
          {incident && (
            <>
              <p>
                Player:{' '}
                {displayPlayerName(incident)}
                {incident.playerJersey ? ` #${incident.playerJersey}` : ''}
                {incident.playerPosition && isPlayerPosition(incident.playerPosition)
                  ? ` · ${PLAYER_POSITION_LABELS[incident.playerPosition]}`
                  : ''}
              </p>
              <p>Time: {incident.minute || judicialCase.color}</p>
              <p>{incident.offenseSummary || incident.reason}</p>
              {(incident.lawIds ?? []).length > 0 && (
                <ul>
                  {(incident.lawIds ?? []).filter(isCardLawId).map((id) => (
                    <li key={id}>{CARD_LAW_LABELS[id]}</li>
                  ))}
                </ul>
              )}
              {report.additionalInfoPrivate && (
                <p className="rs-match-card__meta">
                  Scheduler notes: {report.additionalInfoPrivate}
                </p>
              )}
            </>
          )}
          {!incident && <p>{judicialCase.offenseSummary}</p>}
        </section>
      )}

      {!report && (
        <section className="rs-detail-card">
          <h2 className="rs-detail-section__label">Incident</h2>
          {judicialCase.officialName && (
            <p>Match official: {judicialCase.officialName}</p>
          )}
          {judicialCase.matchDate && <p>Match date: {judicialCase.matchDate}</p>}
          <p>{judicialCase.offenseSummary}</p>
        </section>
      )}

      <section className="rs-detail-card">
        <h2 className="rs-detail-section__label">Player identity</h2>
        <p className="rs-match-card__meta">
          Correct the player name when the referee only knew the jersey number.
          Team: {judicialCase.teamName}
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
              : (Object.keys(JUDICIAL_CASE_STATUS_LABELS) as JudicialCaseStatus[])
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
    </div>
  );
}
