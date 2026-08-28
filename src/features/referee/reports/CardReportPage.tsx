import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
import {
  COMPETITION_UNION_LABELS,
  defaultCompetitionUnion,
  feeCrewSlotForUser,
  kickoffHasPassed,
  prefillOfficialContact,
  type CardColor,
  type CardIncident,
  type CompetitionUnion,
} from '@/domain/reports';
import { assignmentForUser } from '@/domain/types';
import { CardReportViewBody } from '@/features/referee/reports/MatchReportViewPage';
import { persistSubmittedCardReport } from '@/services/reportsLive';
import { useScrollReportToTopOnChange } from '@/features/referee/reports/scrollReportToTop';
import { IconDateInput } from '@/ui/IconDateInput';

type WizardStep = 'identity' | 'cards' | 'done';

function emptyCard(homeId: string, homeName: string): CardIncident {
  return {
    id: `ci_${Math.random().toString(36).slice(2, 9)}`,
    color: 'yellow',
    playerName: '',
    teamId: homeId,
    teamName: homeName,
    minute: '',
    reason: '',
  };
}

export function CardReportPage() {
  const { matchId = '' } = useParams();
  const { currentUser, state, store, dataMode } = useApp();
  const navigate = useNavigate();

  const match = state.matches.find((m) => m.id === matchId);
  // Anyone can read a submitted card report for this match.
  const submittedForMatch = useMemo(() => {
    if (!matchId) return undefined;
    return state.cardReports.find(
      (c) => c.matchId === matchId && c.status === 'submitted',
    );
  }, [matchId, state.cardReports]);

  const already = useMemo(() => {
    if (!currentUser || !matchId) return undefined;
    return state.cardReports.find(
      (c) =>
        c.matchId === matchId &&
        c.officialId === currentUser.uid &&
        c.status === 'submitted',
    );
  }, [currentUser, matchId, state.cardReports]);

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
  const [matchDate, setMatchDate] = useState(() =>
    match ? match.kickoffAt.slice(0, 10) : '',
  );
  const [cards, setCards] = useState<CardIncident[]>(() =>
    match
      ? [emptyCard(match.homeTeamId, match.homeTeamName)]
      : [],
  );
  const [error, setError] = useState<string | null>(null);

  if (!currentUser) return null;

  if (!match) {
    return (
      <div className="rs-stack">
        <Title headingLevel="h2" size="lg">
          Match not found
        </Title>
        <Button
          variant="link"
          onClick={() => navigate('/referee/reports/cards')}
        >
          Back to Card Reports
        </Button>
      </div>
    );
  }

  const isMo = assignmentForUser(match, currentUser.uid)?.slot === 'mo';
  const crewSlot = feeCrewSlotForUser(match, currentUser.uid);
  const kickoffPassed = kickoffHasPassed(match.kickoffAt);

  if (!isMo) {
    if (submittedForMatch) {
      return (
        <div className="rs-stack">
          <button
            type="button"
            className="rs-detail__back"
            onClick={() => navigate(-1)}
          >
            ← Back
          </button>
          <Title headingLevel="h2" size="lg">
            Card report
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
        <Button
          variant="secondary"
          onClick={() => navigate(`/matches/${match.id}`)}
        >
          Back to match
        </Button>
      </div>
    );
  }

  if (!kickoffPassed) {
    return (
      <div className="rs-stack">
        <Title headingLevel="h2" size="lg">
          Card report
        </Title>
        <p className="rs-match-card__meta">
          Available after kickoff for yellow and red cards.
        </p>
        <Button
          variant="secondary"
          onClick={() => navigate(`/matches/${match.id}`)}
        >
          Back to match
        </Button>
      </div>
    );
  }

  if ((already || submittedForMatch) && step !== 'done') {
    return (
      <div className="rs-stack">
        <button
          type="button"
          className="rs-detail__back"
          onClick={() => navigate(-1)}
        >
          ← Back
        </button>
        <Title headingLevel="h2" size="lg">
          Card report on file
        </Title>
        <CardReportViewBody matchId={match.id} />
        <Button
          variant="secondary"
          onClick={() => navigate('/referee/reports/cards')}
        >
          Back to Card Reports
        </Button>
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
        <Button
          variant="secondary"
          onClick={() => navigate('/referee/reports/cards')}
        >
          Back to Card Reports
        </Button>
      </div>
    );
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
        return next;
      }),
    );
  };

  const goCards = () => {
    if (!officialName.trim() || !officialEmail.trim() || !officialPhone.trim()) {
      setError('Name, email, and phone are required.');
      return;
    }
    if (!competitionUnion) {
      setError('Select a competition union.');
      return;
    }
    if (!matchDate) {
      setError('Match date is required.');
      return;
    }
    setError(null);
    setStep('cards');
  };

  const submit = async () => {
    const valid = cards.filter(
      (c) => c.playerName.trim() && c.reason.trim() && c.color,
    );
    if (valid.length === 0) {
      setError('Add at least one card with player name and reason.');
      return;
    }
    const cleaned = valid.map((c) => ({
      ...c,
      playerName: c.playerName.trim(),
      reason: c.reason.trim(),
      minute: c.minute?.trim() || undefined,
      additionalInfoPrivate: c.additionalInfoPrivate?.trim() || undefined,
    }));
    const joinedPrivate = cleaned
      .map((c) => c.additionalInfoPrivate)
      .filter((t): t is string => Boolean(t))
      .join('\n\n');
    setError(null);
    try {
      const input = {
        matchId: match.id,
        officialId: currentUser.uid,
        competitionUnion,
        officialName: officialName.trim(),
        officialEmail: officialEmail.trim(),
        officialPhone: officialPhone.trim(),
        matchDate,
        cards: cleaned,
        additionalInfoPrivate: joinedPrivate || undefined,
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
    }
  };

  return (
    <div className="rs-stack">
      <button
        type="button"
        className="rs-detail__back"
        onClick={() => {
          if (step === 'cards') setStep('identity');
          else navigate('/referee/reports/cards');
        }}
      >
        ← {step === 'cards' ? 'Identity' : 'Card Reports'}
      </button>
      <div ref={reportTopRef}>
        <Title headingLevel="h2" size="lg">
          Card report
        </Title>
      </div>
      <p className="rs-match-card__meta">
        {match.homeTeamName} vs {match.awayTeamName}
      </p>

      <Form
        onSubmit={(e) => {
          e.preventDefault();
          if (step === 'identity') goCards();
          else submit();
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
            <FormGroup
              label="Competition union"
              isRequired
              fieldId="cr-union"
            >
              <FormSelect
                id="cr-union"
                value={competitionUnion}
                onChange={(_e, v) =>
                  setCompetitionUnion(v as CompetitionUnion | '')
                }
                aria-label="Competition union"
              >
                <FormSelectOption value="" label="Select union" />
                {(
                  Object.keys(COMPETITION_UNION_LABELS) as CompetitionUnion[]
                ).map((k) => (
                  <FormSelectOption
                    key={k}
                    value={k}
                    label={COMPETITION_UNION_LABELS[k]}
                  />
                ))}
              </FormSelect>
            </FormGroup>
            <Button type="submit" variant="primary" isBlock>
              Continue to cards
            </Button>
          </>
        )}

        {step === 'cards' && (
          <>
            {cards.map((card, index) => (
              <div key={card.id} className="rs-team-score-card">
                <strong>
                  Card {index + 1}
                  {cards.length > 1 && (
                    <Button
                      variant="link"
                      isInline
                      onClick={() =>
                        setCards((list) => list.filter((c) => c.id !== card.id))
                      }
                    >
                      Remove
                    </Button>
                  )}
                </strong>
                <FormGroup label="Color" isRequired>
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
                <FormGroup label="Player name" isRequired fieldId={`${card.id}-p`}>
                  <TextInput
                    id={`${card.id}-p`}
                    value={card.playerName}
                    onChange={(_e, v) =>
                      updateCard(card.id, { playerName: v })
                    }
                  />
                </FormGroup>
                <FormGroup label="Team" isRequired fieldId={`${card.id}-t`}>
                  <FormSelect
                    id={`${card.id}-t`}
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
                <FormGroup label="Minute" fieldId={`${card.id}-m`}>
                  <TextInput
                    id={`${card.id}-m`}
                    value={card.minute ?? ''}
                    onChange={(_e, v) => updateCard(card.id, { minute: v })}
                  />
                </FormGroup>
                <FormGroup
                  label="Law / reason"
                  isRequired
                  fieldId={`${card.id}-reason`}
                >
                  <TextArea
                    id={`${card.id}-reason`}
                    value={card.reason}
                    onChange={(_e, v) => updateCard(card.id, { reason: v })}
                    rows={3}
                  />
                </FormGroup>
                <FormGroup
                  label="Additional information (Scheduler only)"
                  fieldId={`${card.id}-extra`}
                >
                  <TextArea
                    id={`${card.id}-extra`}
                    value={card.additionalInfoPrivate ?? ''}
                    onChange={(_e, v) =>
                      updateCard(card.id, { additionalInfoPrivate: v })
                    }
                    rows={3}
                    placeholder="Anything else the Scheduler should know about this card — not shown publicly"
                  />
                </FormGroup>
              </div>
            ))}
            <Button
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
            <Button type="submit" variant="primary" isBlock>
              Submit card report
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
