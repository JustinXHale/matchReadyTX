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
  CARD_CONFERENCE_LABELS,
  COMPETITION_UNION_LABELS,
  defaultCardConference,
  defaultCompetitionUnion,
  feeCrewSlotForUser,
  kickoffHasPassed,
  prefillOfficialContact,
  validateCardReportIdentity,
  validateCardReportIncidents,
  cardIncidentsForSubmit,
  type CardColor,
  type CardConference,
  type CardIncident,
  type CompetitionUnion,
  type SecondOffense,
} from '@/domain/reports';
import {
  PLAYER_POSITION_LABELS,
  PLAYER_POSITIONS,
  type CardLawId,
  type PlayerPosition,
} from '@/domain/cardLaws';
import { assignmentForUser } from '@/domain/types';
import { CardReportViewBody } from '@/features/referee/reports/MatchReportViewPage';
import { CARD_REPORTS_BACK } from '@/features/referee/reports/reportLinks';
import { useAppBack } from '@/nav/backNav';
import { persistSubmittedCardReport } from '@/services/reportsLive';
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

function emptySecondOffense(): SecondOffense {
  return {
    color: 'second_yellow_red',
    approximateTime: '',
    lawIds: [],
    summary: '',
  };
}

export function CardReportPage() {
  const { matchId = '' } = useParams();
  const { currentUser, state, store, dataMode } = useApp();
  const navigate = useNavigate();
  const { goBack, backLabel } = useAppBack(CARD_REPORTS_BACK);

  const match = state.matches.find((m) => m.id === matchId);
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
          <button type="button" className="rs-detail__back" onClick={goBack}>
            ← {backLabel}
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
        <button type="button" className="rs-detail__back" onClick={() => navigate(-1)}>
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

  const toggleSecondLaw = (cardId: string, lawId: CardLawId, on: boolean) => {
    setCards((list) =>
      list.map((c) => {
        if (c.id !== cardId) return c;
        const second = c.secondOffense ?? emptySecondOffense();
        const lawIds = on
          ? [...new Set([...second.lawIds, lawId])]
          : second.lawIds.filter((id) => id !== lawId);
        return { ...c, secondOffense: { ...second, lawIds } };
      }),
    );
  };

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

  const submit = async () => {
    const incidentsError = validateCardReportIncidents(cards, matchFilmed);
    if (incidentsError) {
      setError(incidentsError);
      return;
    }
    if (matchFilmed == null) return;
    const cleaned = cardIncidentsForSubmit(cards);
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
        conference:
          competitionUnion === 'ncr_lonestar_college' ? conference : '',
        officialName: officialName.trim(),
        officialEmail: officialEmail.trim(),
        officialPhone: officialPhone.trim(),
        matchDate,
        matchFilmed,
        homeScore: homeScore.trim() ? Number(homeScore) : undefined,
        awayScore: awayScore.trim() ? Number(awayScore) : undefined,
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
            <Button type="submit" variant="primary" isBlock>
              Continue to cards
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
                      onClick={() =>
                        setCards((list) => list.filter((c) => c.id !== card.id))
                      }
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
                <FormGroup label="Did this player receive another card?" isRequired>
                  <Radio
                    id={`${card.id}-more-yes`}
                    name={`${card.id}-more`}
                    label="Yes"
                    isChecked={card.receivedAnotherCard === true}
                    onChange={() =>
                      updateCard(card.id, {
                        receivedAnotherCard: true,
                        secondOffense: card.secondOffense ?? emptySecondOffense(),
                      })
                    }
                  />
                  <Radio
                    id={`${card.id}-more-no`}
                    name={`${card.id}-more`}
                    label="No"
                    isChecked={card.receivedAnotherCard !== true}
                    onChange={() =>
                      updateCard(card.id, {
                        receivedAnotherCard: false,
                        secondOffense: undefined,
                      })
                    }
                  />
                </FormGroup>
                {card.receivedAnotherCard && card.secondOffense && (
                  <>
                    <FormGroup label="Second offense card color" isRequired>
                      <Radio
                        id={`${card.id}-2y`}
                        name={`${card.id}-2color`}
                        label="2nd Yellow - Red"
                        isChecked={
                          card.secondOffense.color === 'second_yellow_red'
                        }
                        onChange={() =>
                          updateCard(card.id, {
                            secondOffense: {
                              ...card.secondOffense!,
                              color: 'second_yellow_red',
                            },
                          })
                        }
                      />
                      <Radio
                        id={`${card.id}-2r`}
                        name={`${card.id}-2color`}
                        label="Red"
                        isChecked={card.secondOffense.color === 'red'}
                        onChange={() =>
                          updateCard(card.id, {
                            secondOffense: {
                              ...card.secondOffense!,
                              color: 'red',
                            },
                          })
                        }
                      />
                    </FormGroup>
                    <FormGroup label="Approximate time of the second infraction" isRequired>
                      <TextInput
                        value={card.secondOffense.approximateTime}
                        onChange={(_e, v) =>
                          updateCard(card.id, {
                            secondOffense: {
                              ...card.secondOffense!,
                              approximateTime: v,
                            },
                          })
                        }
                      />
                    </FormGroup>
                    <FormGroup label="What law was infringed?" isRequired>
                      <CardLawPicker
                        id={`${card.id}-2`}
                        selected={card.secondOffense.lawIds}
                        onToggle={(lawId, on) =>
                          toggleSecondLaw(card.id, lawId, on)
                        }
                      />
                    </FormGroup>
                    <FormGroup label="Second offense summary" isRequired>
                      <TextArea
                        value={card.secondOffense.summary}
                        onChange={(_e, v) =>
                          updateCard(card.id, {
                            secondOffense: {
                              ...card.secondOffense!,
                              summary: v,
                            },
                          })
                        }
                        rows={3}
                      />
                    </FormGroup>
                  </>
                )}
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
