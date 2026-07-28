import { useMemo, useState } from 'react';
import {
  Button,
  Checkbox,
  FormGroup,
  FormSelect,
  FormSelectOption,
  TextArea,
  TextInput,
  Title,
} from '@patternfly/react-core';
import { useNavigate } from 'react-router-dom';
import { useApp, useAppHref } from '@/app/AppContext';
import type { MatchGender } from '@/domain/types';
import { isFirebaseConfigured } from '@/services/firebase';
import {
  createFixtureRequestInFirestore,
  defaultOrgId,
} from '@/services/orgData';

function toLocalDateValue(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function toLocalTimeValue(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function combineKickoff(date: string, time: string): string | null {
  if (!date.trim() || !time.trim()) return null;
  const iso = new Date(`${date}T${time}:00`);
  if (Number.isNaN(iso.getTime())) return null;
  return iso.toISOString();
}

export function RequestFixturePage() {
  const { currentUser, state, store, dataMode, refresh } = useApp();
  const navigate = useNavigate();
  const teamAdminHref = useAppHref('/team-admin');
  const levels = state.org.matchLevels;
  const competitions = state.org.competitions;

  const myTeams = useMemo(() => {
    if (!currentUser) return [];
    return currentUser.teamIds
      .map((id) => state.teams.find((t) => t.id === id))
      .filter((t): t is NonNullable<typeof t> => t != null);
  }, [currentUser, state.teams]);

  const defaultKick = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    d.setHours(15, 0, 0, 0);
    return d;
  }, []);

  const [requesterTeamId, setRequesterTeamId] = useState(
    () => myTeams[0]?.id ?? '',
  );
  const [side, setSide] = useState<'home' | 'away'>('home');
  const [opponentTeamId, setOpponentTeamId] = useState('');
  const [date, setDate] = useState(() => toLocalDateValue(defaultKick));
  const [time, setTime] = useState(() => toLocalTimeValue(defaultKick));
  const [venueName, setVenueName] = useState('');
  const [venueAddress, setVenueAddress] = useState('');
  const [competition, setCompetition] = useState(competitions[0] ?? '');
  const [level, setLevel] = useState(levels[0] ?? 'D1');
  const [gender, setGender] = useState<MatchGender>('men');
  const [notes, setNotes] = useState('');
  const [flightProvided, setFlightProvided] = useState(false);
  const [housingProvided, setHousingProvided] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const opponents = useMemo(
    () => state.teams.filter((t) => t.id !== requesterTeamId),
    [state.teams, requesterTeamId],
  );

  if (!currentUser || !currentUser.roles.includes('teamAdmin')) {
    return (
      <div className="rs-stack">
        <p className="rs-match-card__meta">Team Admin access required.</p>
      </div>
    );
  }

  if (myTeams.length === 0) {
    return (
      <div className="rs-stack">
        <Title headingLevel="h2" size="lg">
          Request a fixture
        </Title>
        <p className="rs-match-card__meta">
          Your account is not linked to a club yet. Ask an assigner to add your
          email on the Contacts sheet, then try again.
        </p>
        <Button variant="link" onClick={() => navigate(teamAdminHref)}>
          Back to Team Admin
        </Button>
      </div>
    );
  }

  const onSubmit = async () => {
    setError(null);
    const kickoffAt = combineKickoff(date, time);
    if (!kickoffAt) {
      setError('Enter a valid date and kickoff time.');
      return;
    }
    if (!requesterTeamId || !opponentTeamId) {
      setError('Select your team and an opponent.');
      return;
    }
    if (!venueName.trim() || !venueAddress.trim()) {
      setError('Venue name and address are required.');
      return;
    }
    if (!level.trim()) {
      setError('Select a level.');
      return;
    }

    setBusy(true);
    try {
      const reqId = store.submitFixtureRequest({
        requesterUserId: currentUser.uid,
        requesterTeamId,
        side,
        opponentTeamId,
        kickoffAt,
        venueName: venueName.trim(),
        venueAddress: venueAddress.trim(),
        competition: competition.trim() || undefined,
        level: level.trim(),
        gender,
        notes: notes.trim() || undefined,
        flightProvided,
        housingProvided,
      });
      if (!reqId) {
        setError('Could not submit — check teams and required fields.');
        return;
      }

      if (dataMode === 'live' && isFirebaseConfigured) {
        const created = store
          .getState()
          .fixtureRequests.find((r) => r.id === reqId);
        if (created) {
          await createFixtureRequestInFirestore(defaultOrgId(), {
            ...created,
            orgId: defaultOrgId(),
          });
        }
      }
      refresh();
      navigate(teamAdminHref);
    } catch (err) {
      console.error('Fixture request failed', err);
      setError(
        err instanceof Error ? err.message : 'Failed to submit fixture request.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rs-stack rs-fixture-form">
      <Button
        variant="link"
        className="rs-detail__back"
        onClick={() => navigate(teamAdminHref)}
      >
        ← Team Admin
      </Button>
      <Title headingLevel="h2" size="lg">
        Request a fixture
      </Title>
      <p className="rs-match-card__meta">
        Submit schedule facts for assigner review. If approved, the match is
        added to the Sheet and released for team confirmation.
      </p>

      <FormGroup label="Your team" isRequired fieldId="fr-my-team">
        <FormSelect
          id="fr-my-team"
          value={requesterTeamId}
          onChange={(_e, v) => {
            setRequesterTeamId(v);
            if (opponentTeamId === v) setOpponentTeamId('');
          }}
          aria-label="Your team"
        >
          {myTeams.map((t) => (
            <FormSelectOption key={t.id} value={t.id} label={t.name} />
          ))}
        </FormSelect>
      </FormGroup>

      <FormGroup label="Your side" isRequired fieldId="fr-side">
        <FormSelect
          id="fr-side"
          value={side}
          onChange={(_e, v) => setSide(v === 'away' ? 'away' : 'home')}
          aria-label="Home or Away"
        >
          <FormSelectOption value="home" label="Home" />
          <FormSelectOption value="away" label="Away" />
        </FormSelect>
      </FormGroup>

      <FormGroup label="Opponent" isRequired fieldId="fr-opponent">
        <FormSelect
          id="fr-opponent"
          value={opponentTeamId}
          onChange={(_e, v) => setOpponentTeamId(v)}
          aria-label="Opponent team"
        >
          <FormSelectOption value="" label="Select opponent…" />
          {opponents.map((t) => (
            <FormSelectOption key={t.id} value={t.id} label={t.name} />
          ))}
        </FormSelect>
      </FormGroup>

      <FormGroup label="Date" isRequired fieldId="fr-date">
        <TextInput
          id="fr-date"
          type="date"
          value={date}
          onChange={(_e, v) => setDate(v)}
        />
      </FormGroup>

      <FormGroup label="Kickoff time" isRequired fieldId="fr-time">
        <TextInput
          id="fr-time"
          type="time"
          value={time}
          onChange={(_e, v) => setTime(v)}
        />
      </FormGroup>

      <FormGroup label="Venue name" isRequired fieldId="fr-venue">
        <TextInput
          id="fr-venue"
          value={venueName}
          onChange={(_e, v) => setVenueName(v)}
          placeholder="Field or complex name"
        />
      </FormGroup>

      <FormGroup label="Venue address" isRequired fieldId="fr-address">
        <TextInput
          id="fr-address"
          value={venueAddress}
          onChange={(_e, v) => setVenueAddress(v)}
          placeholder="Street, city, state, ZIP"
        />
      </FormGroup>

      <FormGroup label="Competition" fieldId="fr-competition">
        <FormSelect
          id="fr-competition"
          value={competition}
          onChange={(_e, v) => setCompetition(v)}
          aria-label="Competition"
        >
          <FormSelectOption value="" label="None" />
          {competitions.map((c) => (
            <FormSelectOption key={c} value={c} label={c} />
          ))}
        </FormSelect>
      </FormGroup>

      <FormGroup label="Level" isRequired fieldId="fr-level">
        <FormSelect
          id="fr-level"
          value={level}
          onChange={(_e, v) => setLevel(v)}
          aria-label="Level"
        >
          {levels.map((l) => (
            <FormSelectOption key={l} value={l} label={l} />
          ))}
        </FormSelect>
      </FormGroup>

      <FormGroup label="Gender" isRequired fieldId="fr-gender">
        <FormSelect
          id="fr-gender"
          value={gender}
          onChange={(_e, v) => setGender(v === 'women' ? 'women' : 'men')}
          aria-label="Gender"
        >
          <FormSelectOption value="men" label="Men" />
          <FormSelectOption value="women" label="Women" />
        </FormSelect>
      </FormGroup>

      <FormGroup label="Notes" fieldId="fr-notes">
        <TextArea
          id="fr-notes"
          value={notes}
          onChange={(_e, v) => setNotes(v)}
          rows={3}
          aria-label="Notes"
        />
      </FormGroup>

      <Checkbox
        id="fr-flight"
        label="Flight provided"
        isChecked={flightProvided}
        onChange={(_e, checked) => setFlightProvided(checked)}
      />
      <Checkbox
        id="fr-housing"
        label="Housing provided"
        isChecked={housingProvided}
        onChange={(_e, checked) => setHousingProvided(checked)}
      />

      {error && (
        <p className="rs-match-card__meta" role="alert">
          {error}
        </p>
      )}

      <Button
        variant="primary"
        isDisabled={busy}
        isLoading={busy}
        onClick={() => void onSubmit()}
      >
        Submit request
      </Button>
    </div>
  );
}
