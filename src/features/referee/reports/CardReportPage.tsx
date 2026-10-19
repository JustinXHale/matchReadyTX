import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Button,
  Form,
  FormGroup,
  FormSelect,
  FormSelectOption,
  Radio,
  TextArea,
  TextInput,
  Title,
} from '@patternfly/react-core';
import { useApp } from '@/app/AppContext';
import { useAppFeedback } from '@/app/feedback/feedbackContext';
import {
  CARD_CONFERENCE_LABELS,
  COMPETITION_UNION_LABELS,
  cardReportDocId,
  defaultCardConference,
  defaultCompetitionUnion,
  feeCrewSlotForUser,
  isCardReportEditable,
  isCardReportLocked,
  kickoffHasPassed,
  prefillOfficialContact,
  validateCardReportIdentity,
  validateCardReportIncidents,
  cardIncidentsForSubmit,
  type CardColor,
  type CardConference,
  type CardIncident,
  type CompetitionUnion,
} from '@/domain/reports';
import {
  PLAYER_POSITION_LABELS,
  PLAYER_POSITIONS,
  type CardLawId,
  type PlayerPosition,
} from '@/domain/cardLaws';
import { assignmentForUser } from '@/domain/types';
import {
  latestReopenForReport,
  pendingReopenForReport,
  validateReopenRequestReason,
} from '@/domain/cardReportReopen';
import { hasJudicialCaseForIncident } from '@/domain/judicial';
import { CardReportViewBody } from '@/features/referee/reports/MatchReportViewPage';
import { CARD_REPORTS_BACK } from '@/features/referee/reports/reportLinks';
import { useAppBack } from '@/nav/backNav';
import { useContextualBackBar } from '@/app/shell/contextualBar';
import {
  persistDraftCardReport,
  persistSubmittedCardReport,
} from '@/services/reportsLive';
import {
  callRequestCardReportReopen,
  callableErrorMessage,
} from '@/services/orgData';
import { useScrollReportToTopOnChange } from '@/features/referee/reports/scrollReportToTop';
import { IconDateInput } from '@/ui/IconDateInput';
import { CardLawPicker } from '@/ui/CardLawPicker';

type WizardStep = 'identity' | 'cards' | 'done';

function emptyCard(homeId: string, homeName: string): CardIncident {
  return {
    id: `ci_${Math.random().toString(36).slice(2, 9)}`,
    color: 'yellow',
    playerName: '',
    playerFirstName: '',
    playerLastName: '',
    playerJersey: '',
    playerPosition: '',
    teamId: homeId,
    teamName: homeName,
    minute: '',
    reason: '',
    lawIds: [],
    offenseSummary: '',
    receivedAnotherCard: false,
  };
}

export function CardReportPage() {
  const { matchId = '' } = useParams();
  const { currentUser, state, store, dataMode } = useApp();
  const { confirm } = useAppFeedback();
  const { goBack, backLabel } = useAppBack(CARD_REPORTS_BACK);

  const match = state.matches.find((m) => m.id === matchId);
  const ownReport = useMemo(() => {
    if (!currentUser || !matchId) return undefined;
    return state.cardReports.find(
      (c) => c.matchId === matchId && c.officialId === currentUser.uid,
    );
  }, [currentUser, matchId, state.cardReports]);

  const submittedForMatch = useMemo(() => {
    if (!matchId) return undefined;
    return state.cardReports.find(
      (c) => c.matchId === matchId && c.status === 'submitted',
    );
  }, [matchId, state.cardReports]);

  const canPrivilegedEdit = Boolean(
    currentUser?.roles.includes('assigner') ||
      currentUser?.roles.includes('judicial'),
  );

  const editableReport = useMemo(() => {
    if (ownReport && isCardReportEditable(ownReport)) return ownReport;
    if (
      canPrivilegedEdit &&
      submittedForMatch &&
      isCardReportEditable(submittedForMatch)
    ) {
      return submittedForMatch;
    }
    return undefined;
  }, [ownReport, submittedForMatch, canPrivilegedEdit]);

  const lockedOwn =
    ownReport && isCardReportLocked(ownReport) ? ownReport : undefined;
  const lockedAny =
    !editableReport &&
    submittedForMatch &&
    isCardReportLocked(submittedForMatch)
      ? submittedForMatch
      : undefined;

  const pendingReopen = lockedOwn
    ? pendingReopenForReport(state.cardReportReopenRequests, lockedOwn.id)
    : undefined;
  const latestReopen = lockedOwn
    ? latestReopenForReport(state.cardReportReopenRequests, lockedOwn.id)
    : undefined;

  const contact = currentUser
    ? prefillOfficialContact(currentUser)
    : { officialName: '', officialEmail: '', officialPhone: '' };

  const [step, setStep] = useState<WizardStep>('identity');
  const reportTopRef = useScrollReportToTopOnChange<HTMLDivElement>(step);
  const [officialName, setOfficialName] = useState(contact.officialName);
  const [officialEmail, setOfficialEmail] = useState(contact.officialEmail);
  const [officialPhone, setOfficialPhone] = useState(contact.officialPhone);
  const [competitionUnion, setCompetitionUnion] = useState<
    CompetitionUnion | ''
  >(match ? defaultCompetitionUnion(match) : '');
  const [conference, setConference] = useState<CardConference | ''>(
    match ? defaultCardConference(match) : '',
  );
  const [matchDate, setMatchDate] = useState(() =>
    match ? match.kickoffAt.slice(0, 10) : '',
  );
  const [matchFilmed, setMatchFilmed] = useState<boolean | null>(null);
  const [homeScore, setHomeScore] = useState(
    match?.homeScore != null ? String(match.homeScore) : '',
  );
  const [awayScore, setAwayScore] = useState(
    match?.awayScore != null ? String(match.awayScore) : '',
  );
  const [cards, setCards] = useState<CardIncident[]>(() =>
    match ? [emptyCard(match.homeTeamId, match.homeTeamName)] : [],
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [reopenReason, setReopenReason] = useState('');
  const [showReopenForm, setShowReopenForm] = useState(false);
  const [reopenBusy, setReopenBusy] = useState(false);
  const [hydratedId, setHydratedId] = useState<string | null>(null);

  useEffect(() => {
    if (!editableReport || !match) return;
    if (hydratedId === editableReport.id) return;
    setOfficialName(editableReport.officialName || contact.officialName);
    setOfficialEmail(editableReport.officialEmail || contact.officialEmail);
    setOfficialPhone(editableReport.officialPhone || contact.officialPhone);
    setCompetitionUnion(editableReport.competitionUnion || '');
    setConference(editableReport.conference || '');
    setMatchDate(editableReport.matchDate || match.kickoffAt.slice(0, 10));
    setMatchFilmed(
      typeof editableReport.matchFilmed === 'boolean'
        ? editableReport.matchFilmed
        : null,
    );
    setHomeScore(
      editableReport.homeScore != null
        ? String(editableReport.homeScore)
        : match.homeScore != null
          ? String(match.homeScore)
          : '',
    );
    setAwayScore(
      editableReport.awayScore != null
        ? String(editableReport.awayScore)
        : match.awayScore != null
          ? String(match.awayScore)
          : '',
    );
    setCards(
      editableReport.cards.length
        ? editableReport.cards
        : [emptyCard(match.homeTeamId, match.homeTeamName)],
    );
    setStep(
      editableReport.cards.length && editableReport.matchFilmed != null
        ? 'cards'
        : 'identity',
    );
    setHydratedId(editableReport.id);
  }, [editableReport, match, contact, hydratedId]);

  const handleContextualBack = useCallback(() => {
    if (step === 'cards') {
      setStep('identity');
      return;
    }
    goBack();
  }, [goBack, step]);
  useContextualBackBar(
    step === 'cards' ? 'Back to Identity' : backLabel,
    handleContextualBack,
  );

  if (!currentUser) return null;

  if (!match) {
    return (
      <div className="rs-stack">
        <Title headingLevel="h2" size="lg">
          Match not found
        </Title>
      </div>
    );
  }

  const isMo = assignmentForUser(match, currentUser.uid)?.slot === 'mo';
  const crewSlot = feeCrewSlotForUser(match, currentUser.uid);
  const kickoffPassed = kickoffHasPassed(match.kickoffAt);
  const filingOfficialId = editableReport?.officialId ?? currentUser.uid;
  const reportId =
    editableReport?.id ?? cardReportDocId(match.id, filingOfficialId);

  if (!kickoffPassed) {
    return (
      <div className="rs-stack">
        <Title headingLevel="h2" size="lg">
          Card report
        </Title>
        <p className="rs-match-card__meta">
          Available after kickoff for yellow and red cards.
        </p>
      </div>
    );
  }

  // Non-MO: view locked report (with unlock menu) or wait for MO / unlock.
  if (!isMo && !editableReport) {
    if (submittedForMatch || lockedAny) {
      return (
        <div className="rs-stack">
          <Title headingLevel="h2" size="lg">
            Card report on file
          </Title>
          <CardReportViewBody matchId={match.id} />
        </div>
      );
    }
    return (
      <div className="rs-stack">
        <Title headingLevel="h2" size="lg">
          Card report (Match Official)
        </Title>
        <p className="rs-match-card__meta">
          Card reports are filed by the Match Official
          {crewSlot ? ` (you are ${crewSlot.toUpperCase()} on this match)` : ''}.
        </p>
      </div>
    );
  }

  // Locked submitted — read-only + MO reopen request
  if ((lockedOwn || lockedAny) && step !== 'done' && !editableReport) {
    const locked = lockedOwn ?? lockedAny!;
    return (
      <div className="rs-stack">
        <Title headingLevel="h2" size="lg">
          Card report on file
        </Title>
        <CardReportViewBody matchId={match.id} />
        {lockedOwn && isMo && (
          <div className="rs-stack">
            {pendingReopen ? (
              <p className="rs-match-card__meta" role="status">
                Reopen request pending review by Scheduler or Judicial.
              </p>
            ) : latestReopen?.status === 'denied' ? (
              <p className="rs-match-card__meta" role="status">
                Reopen denied
                {latestReopen.denyReason
                  ? `: ${latestReopen.denyReason}`
                  : '.'}{' '}
                You may submit a new request.
              </p>
            ) : null}
            {showReopenForm ? (
              <>
                <FormGroup label="Why do you need to reopen?" isRequired>
                  <TextArea
                    value={reopenReason}
                    onChange={(_e, v) => setReopenReason(v)}
                    rows={3}
                    placeholder="e.g. Need to add remaining yellow cards"
                  />
                </FormGroup>
                {error && (
                  <p className="rs-match-card__meta" role="alert">
                    {error}
                  </p>
                )}
                <div className="rs-actions rs-actions--inline">
                  <Button
                    variant="primary"
                    isDisabled={reopenBusy}
                    isLoading={reopenBusy}
                    onClick={() => void requestReopen(locked.id)}
                  >
                    Submit request
                  </Button>
                  <Button
                    variant="link"
                    onClick={() => {
                      setShowReopenForm(false);
                      setError(null);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </>
            ) : (
              !pendingReopen && (
                <Button
                  variant="secondary"
                  onClick={() => setShowReopenForm(true)}
                >
                  Request reopen
                </Button>
              )
            )}
          </div>
        )}
      </div>
    );
  }

  if (step === 'done') {
    return (
      <div className="rs-stack">
        <Title headingLevel="h2" size="lg">
          Card report submitted
        </Title>
        <p className="rs-match-card__meta">
          {match.homeTeamName} vs {match.awayTeamName}
        </p>
      </div>
    );
  }

  async function requestReopen(id: string) {
    const reasonError = validateReopenRequestReason(reopenReason);
    if (reasonError) {
      setError(reasonError);
      return;
    }
    setReopenBusy(true);
    setError(null);
    try {
      if (dataMode === 'live') {
        await callRequestCardReportReopen({
          reportId: id,
          requestReason: reopenReason.trim(),
        });
      } else {
        store.requestCardReportReopen({
          reportId: id,
          matchId: match!.id,
          matchLabel: `${match!.homeTeamName} vs ${match!.awayTeamName}`,
          requesterUserId: currentUser!.uid,
          requesterName: currentUser!.displayName || 'Official',
          requesterEmail: currentUser!.email || '',
          requestReason: reopenReason.trim(),
        });
      }
      setShowReopenForm(false);
      setReopenReason('');
    } catch (err) {
      setError(
        callableErrorMessage(err, 'Could not submit reopen request.'),
      );
    } finally {
      setReopenBusy(false);
    }
  }

  const updateCard = (id: string, patch: Partial<CardIncident>) => {
    setCards((list) =>
      list.map((c) => {
        if (c.id !== id) return c;
        const next = { ...c, ...patch };
        if (patch.teamId === match.homeTeamId) {
          next.teamName = match.homeTeamName;
        } else if (patch.teamId === match.awayTeamId) {
          next.teamName = match.awayTeamName;
        }
        const first = next.playerFirstName?.trim() ?? '';
        const last = next.playerLastName?.trim() ?? '';
        if (first || last) next.playerName = `${first} ${last}`.trim();
        return next;
      }),
    );
  };

  const toggleLaw = (cardId: string, lawId: CardLawId, on: boolean) => {
    setCards((list) =>
      list.map((c) => {
        if (c.id !== cardId) return c;
        const current = c.lawIds ?? [];
        const lawIds = on
          ? [...new Set([...current, lawId])]
          : current.filter((id) => id !== lawId);
        return { ...c, lawIds };
      }),
    );
  };

  const buildInput = () => ({
    id: reportId,
    matchId: match.id,
    officialId: filingOfficialId,
    competitionUnion,
    conference:
      competitionUnion === 'ncr_lonestar_college' ? conference : ('' as const),
    officialName: officialName.trim(),
    officialEmail: officialEmail.trim(),
    officialPhone: officialPhone.trim(),
    matchDate,
    matchFilmed: matchFilmed ?? undefined,
    homeScore: homeScore.trim() ? Number(homeScore) : undefined,
    awayScore: awayScore.trim() ? Number(awayScore) : undefined,
    cards,
    additionalInfoPrivate: cards
      .map((c) => c.additionalInfoPrivate)
      .filter((t): t is string => Boolean(t))
      .join('\n\n') || undefined,
  });

  const goCards = () => {
    const identityError = validateCardReportIdentity({
      officialName,
      officialEmail,
      officialPhone,
      competitionUnion,
      conference,
      matchDate,
    });
    if (identityError) {
      setError(identityError);
      return;
    }
    setError(null);
    setStep('cards');
  };

  const saveDraft = async () => {
    if (savingDraft || submitting) return;
    const identityError = validateCardReportIdentity({
      officialName,
      officialEmail,
      officialPhone,
      competitionUnion,
      conference,
      matchDate,
    });
    if (identityError) {
      setError(identityError);
      return;
    }
    setError(null);
    setSavingDraft(true);
    try {
      if (dataMode === 'live') {
        await persistDraftCardReport(buildInput());
      } else {
        store.saveDraftCardReport(buildInput());
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not save draft.',
      );
    } finally {
      setSavingDraft(false);
    }
  };

  const submit = async () => {
    if (submitting || savingDraft) return;
    const incidentsError = validateCardReportIncidents(cards, matchFilmed);
    if (incidentsError) {
      setError(incidentsError);
      return;
    }
    if (matchFilmed == null) return;
    const cleaned = cardIncidentsForSubmit(cards);
    const ok = await confirm({
      title: 'Submit card report?',
      message: `Submit ${cleaned.length} card${cleaned.length === 1 ? '' : 's'} for ${match.homeTeamName} vs ${match.awayTeamName}? This locks the report until Scheduler or Judicial unlocks it.`,
      confirmLabel: 'Submit',
    });
    if (!ok) return;

    setError(null);
    setSubmitting(true);
    try {
      const input = {
        ...buildInput(),
        cards: cleaned,
        matchFilmed,
      };
      if (dataMode === 'live') {
        await persistSubmittedCardReport(input);
      } else {
        store.submitCardReport(input);
      }
      setStep('done');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not save card report.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const removeCard = (cardId: string) => {
    if (
      editableReport?.status === 'submitted' &&
      hasJudicialCaseForIncident(
        state.judicialCases,
        editableReport.id,
        cardId,
      )
    ) {
      setError(
        'This card already has a judicial case and cannot be removed. Edit fields instead, or ask Scheduler to help.',
      );
      return;
    }
    setCards((list) => list.filter((c) => c.id !== cardId));
  };

  return (
    <div className="rs-stack">
      <div ref={reportTopRef}>
        <Title headingLevel="h2" size="lg">
          Card report
          {editableReport?.status === 'draft' ? ' (draft)' : ''}
          {editableReport?.editUnlockedAt ? ' (unlocked for edit)' : ''}
        </Title>
      </div>
      <p className="rs-match-card__meta">
        {match.homeTeamName} vs {match.awayTeamName}
      </p>

      <Form
        onSubmit={(e) => {
          e.preventDefault();
        }}
      >
        {step === 'identity' && (
          <>
            <FormGroup label="Match Official name" isRequired fieldId="cr-name">
              <TextInput
                id="cr-name"
                value={officialName}
                onChange={(_e, v) => setOfficialName(v)}
              />
            </FormGroup>
            <FormGroup label="Email" isRequired fieldId="cr-email">
              <TextInput
                id="cr-email"
                type="email"
                value={officialEmail}
                onChange={(_e, v) => setOfficialEmail(v)}
              />
            </FormGroup>
            <FormGroup label="Phone" isRequired fieldId="cr-phone">
              <TextInput
                id="cr-phone"
                type="tel"
                value={officialPhone}
                onChange={(_e, v) => setOfficialPhone(v)}
              />
            </FormGroup>
            <FormGroup label="Match date" isRequired fieldId="cr-date">
              <IconDateInput
                id="cr-date"
                type="date"
                value={matchDate}
                onChange={(_e, v) => setMatchDate(v)}
              />
            </FormGroup>
            <FormGroup label="Competition union" isRequired fieldId="cr-union">
              <FormSelect
                id="cr-union"
                value={competitionUnion}
                onChange={(_e, v) =>
                  setCompetitionUnion(v as CompetitionUnion | '')
                }
                aria-label="Competition union"
              >
                <FormSelectOption value="" label="Select union" />
                {(Object.keys(COMPETITION_UNION_LABELS) as CompetitionUnion[]).map(
                  (k) => (
                    <FormSelectOption
                      key={k}
                      value={k}
                      label={COMPETITION_UNION_LABELS[k]}
                    />
                  ),
                )}
              </FormSelect>
            </FormGroup>
            {competitionUnion === 'ncr_lonestar_college' && (
              <FormGroup label="Which conference is this for?" isRequired>
                <Radio
                  id="cr-conf-men"
                  name="cr-conf"
                  label={CARD_CONFERENCE_LABELS.lonestar_men}
                  isChecked={conference === 'lonestar_men'}
                  onChange={() => setConference('lonestar_men')}
                />
                <Radio
                  id="cr-conf-women"
                  name="cr-conf"
                  label={CARD_CONFERENCE_LABELS.lonestar_women}
                  isChecked={conference === 'lonestar_women'}
                  onChange={() => setConference('lonestar_women')}
                />
              </FormGroup>
            )}
            <Button
              type="button"
              variant="primary"
              isBlock
              onClick={goCards}
            >
              Continue to cards
            </Button>
            <Button
              type="button"
              variant="secondary"
              isBlock
              isDisabled={savingDraft}
              isLoading={savingDraft}
              onClick={() => void saveDraft()}
            >
              Save as draft
            </Button>
          </>
        )}

        {step === 'cards' && (
          <>
            <FormGroup label="To your knowledge, was the match filmed?" isRequired>
              <Radio
                id="cr-film-yes"
                name="cr-film"
                label="Yes"
                isChecked={matchFilmed === true}
                onChange={() => setMatchFilmed(true)}
              />
              <Radio
                id="cr-film-no"
                name="cr-film"
                label="No"
                isChecked={matchFilmed === false}
                onChange={() => setMatchFilmed(false)}
              />
            </FormGroup>
            <FormGroup label={`${match.homeTeamName} score`} fieldId="cr-hs">
              <TextInput
                id="cr-hs"
                value={homeScore}
                onChange={(_e, v) => setHomeScore(v)}
              />
            </FormGroup>
            <FormGroup label={`${match.awayTeamName} score`} fieldId="cr-as">
              <TextInput
                id="cr-as"
                value={awayScore}
                onChange={(_e, v) => setAwayScore(v)}
              />
            </FormGroup>
            {cards.map((card, index) => (
              <div key={card.id} className="rs-team-score-card">
                <strong>
                  Card {index + 1}
                  {cards.length > 1 && (
                    <Button
                      variant="link"
                      isInline
                      onClick={() => removeCard(card.id)}
                    >
                      Remove
                    </Button>
                  )}
                </strong>
                <FormGroup label="Card color" isRequired>
                  <Radio
                    id={`${card.id}-y`}
                    name={`${card.id}-color`}
                    label="Yellow"
                    isChecked={card.color === 'yellow'}
                    onChange={() =>
                      updateCard(card.id, { color: 'yellow' as CardColor })
                    }
                  />
                  <Radio
                    id={`${card.id}-r`}
                    name={`${card.id}-color`}
                    label="Red"
                    isChecked={card.color === 'red'}
                    onChange={() =>
                      updateCard(card.id, { color: 'red' as CardColor })
                    }
                  />
                </FormGroup>
                <FormGroup label="Player jersey number">
                  <TextInput
                    value={card.playerJersey ?? ''}
                    onChange={(_e, v) =>
                      updateCard(card.id, { playerJersey: v })
                    }
                  />
                  <p className="rs-match-card__meta">
                    Jersey alone is enough if the name is unknown. Judicial can
                    complete the name later.
                  </p>
                </FormGroup>
                <FormGroup label="Player last name (if known)">
                  <TextInput
                    value={card.playerLastName ?? ''}
                    onChange={(_e, v) =>
                      updateCard(card.id, { playerLastName: v })
                    }
                  />
                </FormGroup>
                <FormGroup label="Player first name (if known)">
                  <TextInput
                    value={card.playerFirstName ?? ''}
                    onChange={(_e, v) =>
                      updateCard(card.id, { playerFirstName: v })
                    }
                  />
                </FormGroup>
                <FormGroup label="Player position">
                  <FormSelect
                    value={card.playerPosition ?? ''}
                    onChange={(_e, v) =>
                      updateCard(card.id, {
                        playerPosition: v as PlayerPosition | '',
                      })
                    }
                    aria-label="Player position"
                  >
                    <FormSelectOption value="" label="Choose" />
                    {PLAYER_POSITIONS.map((p) => (
                      <FormSelectOption
                        key={p}
                        value={p}
                        label={PLAYER_POSITION_LABELS[p]}
                      />
                    ))}
                  </FormSelect>
                </FormGroup>
                <FormGroup label="Player team" isRequired>
                  <FormSelect
                    value={card.teamId}
                    onChange={(_e, v) => updateCard(card.id, { teamId: v })}
                    aria-label="Team"
                  >
                    <FormSelectOption
                      value={match.homeTeamId}
                      label={match.homeTeamName}
                    />
                    <FormSelectOption
                      value={match.awayTeamId}
                      label={match.awayTeamName}
                    />
                  </FormSelect>
                </FormGroup>
                <FormGroup
                  label="Approximate time of the infraction / incident"
                  isRequired
                >
                  <TextInput
                    value={card.minute ?? ''}
                    onChange={(_e, v) => updateCard(card.id, { minute: v })}
                    placeholder="e.g. 34 or early in second half"
                  />
                </FormGroup>
                <FormGroup label="What law was infringed?" isRequired>
                  <CardLawPicker
                    id={card.id}
                    selected={card.lawIds ?? []}
                    onToggle={(lawId, on) => toggleLaw(card.id, lawId, on)}
                  />
                </FormGroup>
                <FormGroup
                  label="In your own words, explain and summarize the offense"
                  isRequired
                >
                  <TextArea
                    value={card.offenseSummary ?? card.reason}
                    onChange={(_e, v) =>
                      updateCard(card.id, { offenseSummary: v, reason: v })
                    }
                    rows={4}
                  />
                </FormGroup>
                <p className="rs-match-card__meta">
                  If the same player receives a second yellow in this match, use{' '}
                  <strong>Add another card</strong> and file that yellow
                  separately. A send-off (red) is created automatically from the
                  two yellows — you do not write a separate red report.
                </p>
                <FormGroup label="Additional information (Scheduler only)">
                  <TextArea
                    value={card.additionalInfoPrivate ?? ''}
                    onChange={(_e, v) =>
                      updateCard(card.id, { additionalInfoPrivate: v })
                    }
                    rows={3}
                    placeholder="Anything else the Scheduler should know — not shown publicly"
                  />
                </FormGroup>
              </div>
            ))}
            <Button
              type="button"
              variant="secondary"
              className="rs-btn--gold"
              isBlock
              onClick={() =>
                setCards((list) => [
                  ...list,
                  emptyCard(match.homeTeamId, match.homeTeamName),
                ])
              }
            >
              Add another card
            </Button>
            <Button
              type="button"
              variant="secondary"
              isBlock
              isDisabled={savingDraft || submitting}
              isLoading={savingDraft}
              onClick={() => void saveDraft()}
            >
              Save as draft
            </Button>
            <Button
              type="button"
              variant="primary"
              isBlock
              isDisabled={submitting || savingDraft}
              isLoading={submitting}
              onClick={() => void submit()}
            >
              {editableReport?.editUnlockedAt
                ? 'Submit and lock'
                : 'Submit card report'}
            </Button>
          </>
        )}

        {error && (
          <p className="rs-match-card__meta" role="alert">
            {error}
          </p>
        )}
      </Form>
    </div>
  );
}
