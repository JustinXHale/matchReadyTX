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
import { useContextualAppBack } from '@/app/shell/contextualBar';
import { competitionsEqual } from '@/domain/competitions';
import { OTHER_OPPONENT_TEAM_ID } from '@/domain/fixtureRequests';
import { teamDisplayAbbreviation } from '@/domain/matchCardFooter';
import { dedupeTeamsForPicker } from '@/domain/teamList';
import {
  conferenceTeamOptionLabel,
  conferenceTeamOptions,
} from '@/domain/teams';
import type { MatchGender } from '@/domain/types';
import { isFirebaseConfigured } from '@/services/firebase';
import { callCreateMatch, defaultOrgId } from '@/services/orgData';
import '@/features/teamAdmin/team-admin.css';

const REFEREE_TRAVEL_NOTE =
  '*might be required for matches more than 5 hours outside Dallas, Houston, Austin, San Antonio.';

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

/** Assigner creates a match (Sheet + Firestore) without a fixture-request queue. */
export function AddMatchPage() {
  const { currentUser, state, store, dataMode, refresh, hasAssignerRole } =
    useApp();
  const navigate = useNavigate();
  const scheduleHref = useAppHref('/scheduler/schedule');
  const matchHref = useAppHref('/matches');
  const addMatchBack = useMemo(
    () => ({ to: scheduleHref, label: 'Schedule' }),
    [scheduleHref],
  );
  useContextualAppBack(addMatchBack);

  const levels = state.org.matchLevels;
  const competitions = state.org.competitions;
  const teams = state.teams;

  const defaultKick = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    d.setHours(15, 0, 0, 0);
    return d;
  }, []);

  const [homeTeamId, setHomeTeamId] = useState('');
  const [awayTeamId, setAwayTeamId] = useState('');
  const [homeOtherName, setHomeOtherName] = useState('');
  const [awayOtherName, setAwayOtherName] = useState('');
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
  const [fieldErrors, setFieldErrors] = useState<{
    home?: boolean;
    away?: boolean;
  }>({});
  const [busy, setBusy] = useState(false);

  const homeOther = homeTeamId === OTHER_OPPONENT_TEAM_ID;
  const awayOther = awayTeamId === OTHER_OPPONENT_TEAM_ID;

  const rosterOptions = useMemo(
    () => conferenceTeamOptions(dedupeTeamsForPicker(teams)),
    [teams],
  );

  const filteredRoster = useMemo(() => {
    const selected = competition.trim();
    if (!selected) return rosterOptions;
    return rosterOptions.filter((option) =>
      competitionsEqual(option.conference, selected),
    );
  }, [rosterOptions, competition]);

  const homeOptions = useMemo(
    () =>
      filteredRoster.filter(
        (option) => option.id !== awayTeamId || awayOther,
      ),
    [filteredRoster, awayTeamId, awayOther],
  );
  const awayOptions = useMemo(
    () =>
      filteredRoster.filter(
        (option) => option.id !== homeTeamId || homeOther,
      ),
    [filteredRoster, homeTeamId, homeOther],
  );

  if (!currentUser || !hasAssignerRole) {
    return (
      <div className="rs-stack">
        <p className="rs-match-card__meta">Scheduler access required.</p>
      </div>
    );
  }

  const resolveTeamName = (
    teamId: string,
    otherName: string,
  ): string | null => {
    if (teamId === OTHER_OPPONENT_TEAM_ID) {
      const name = otherName.trim();
      return name || null;
    }
    const team = teams.find((t) => t.id === teamId);
    if (!team) return null;
    return teamDisplayAbbreviation(team, team.name);
  };

  const onSubmit = async () => {
    setError(null);
    setFieldErrors({});
    const kickoffAt = combineKickoff(date, time);
    if (!kickoffAt) {
      setError('Enter a valid date and kickoff time.');
      return;
    }
    if (!homeTeamId || !awayTeamId) {
      setError('Select home and away teams.');
      setFieldErrors({
        home: !homeTeamId,
        away: !awayTeamId,
      });
      return;
    }
    if (homeTeamId === awayTeamId && homeTeamId !== OTHER_OPPONENT_TEAM_ID) {
      setError('Home and away must be different teams.');
      setFieldErrors({ home: true, away: true });
      return;
    }
    const homeTeamName = resolveTeamName(homeTeamId, homeOtherName);
    const awayTeamName = resolveTeamName(awayTeamId, awayOtherName);
    if (!homeTeamName) {
      setError(homeOther ? 'Enter the home team name.' : 'Select a home team.');
      setFieldErrors({ home: true });
      return;
    }
    if (!awayTeamName) {
      setError(awayOther ? 'Enter the away team name.' : 'Select an away team.');
      setFieldErrors({ away: true });
      return;
    }
    if (
      homeOther &&
      awayOther &&
      homeTeamName.toLowerCase() === awayTeamName.toLowerCase()
    ) {
      setError('Home and away team names must be different.');
      setFieldErrors({ home: true, away: true });
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

    const facts = {
      homeTeamId,
      awayTeamId,
      homeTeamName,
      awayTeamName,
      kickoffAt,
      venueName: venueName.trim(),
      venueAddress: venueAddress.trim(),
      competition: competition.trim() || undefined,
      level: level.trim(),
      gender,
      notes: notes.trim() || undefined,
      flightProvided,
      housingProvided,
    };

    setBusy(true);
    try {
      let matchId: string | null = null;
      if (dataMode === 'live' && isFirebaseConfigured) {
        const created = await callCreateMatch({
          orgId: defaultOrgId(),
          ...facts,
        });
        matchId = store.createMatch(facts, {
          matchId: created.matchId,
          sheetRowKey: created.sheetRowKey,
        });
        refresh();
      } else {
        matchId = store.createMatch(facts);
      }
      if (!matchId) {
        setError('Could not create match — check teams and required fields.');
        return;
      }
      navigate(`${matchHref}/${matchId}`);
    } catch (err) {
      console.error('Create match failed', err);
      const message =
        err instanceof Error ? err.message : 'Failed to create match.';
      setError(message);
      if (
        /distinct home and away|team names must be different|select home and away/i.test(
          message,
        )
      ) {
        setFieldErrors({ home: true, away: true });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rs-stack rs-fixture-form">
      <Title headingLevel="h1" size="lg">
        Add a match
      </Title>
      <p className="rs-match-card__meta">
        Creates the match on the Google Sheet and releases it for team
        confirmation. Neither side is pre-confirmed.
      </p>

      <div
        className={
          homeOther ? 'rs-form-row rs-form-row--2' : 'rs-fixture-form__opponent'
        }
      >
        <FormGroup label="Home team" isRequired fieldId="am-home">
          <FormSelect
            id="am-home"
            value={homeTeamId}
            validated={fieldErrors.home ? 'error' : 'default'}
            onChange={(_e, v) => {
              setHomeTeamId(v);
              setFieldErrors((current) => ({ ...current, home: false }));
              if (v !== OTHER_OPPONENT_TEAM_ID) setHomeOtherName('');
              if (v && v === awayTeamId && v !== OTHER_OPPONENT_TEAM_ID) {
                setAwayTeamId('');
                setAwayOtherName('');
              }
            }}
            aria-label="Home team"
          >
            <FormSelectOption value="" label="Select home…" />
            {homeOptions.map((option) => (
              <FormSelectOption
                key={option.id}
                value={option.id}
                label={conferenceTeamOptionLabel(option)}
              />
            ))}
            <FormSelectOption value={OTHER_OPPONENT_TEAM_ID} label="Other…" />
          </FormSelect>
        </FormGroup>

        {homeOther ? (
          <FormGroup label="Home team name" isRequired fieldId="am-home-name">
            <TextInput
              id="am-home-name"
              value={homeOtherName}
              validated={fieldErrors.home ? 'error' : 'default'}
              onChange={(_e, v) => {
                setHomeOtherName(v);
                setFieldErrors((current) => ({ ...current, home: false }));
              }}
              placeholder="Club or school name"
              aria-label="Home team name"
            />
          </FormGroup>
        ) : null}
      </div>

      <div
        className={
          awayOther ? 'rs-form-row rs-form-row--2' : 'rs-fixture-form__opponent'
        }
      >
        <FormGroup label="Away team" isRequired fieldId="am-away">
          <FormSelect
            id="am-away"
            value={awayTeamId}
            validated={fieldErrors.away ? 'error' : 'default'}
            onChange={(_e, v) => {
              setAwayTeamId(v);
              setFieldErrors((current) => ({ ...current, away: false }));
              if (v !== OTHER_OPPONENT_TEAM_ID) setAwayOtherName('');
              if (v && v === homeTeamId && v !== OTHER_OPPONENT_TEAM_ID) {
                setHomeTeamId('');
                setHomeOtherName('');
              }
            }}
            aria-label="Away team"
          >
            <FormSelectOption value="" label="Select away…" />
            {awayOptions.map((option) => (
              <FormSelectOption
                key={option.id}
                value={option.id}
                label={conferenceTeamOptionLabel(option)}
              />
            ))}
            <FormSelectOption value={OTHER_OPPONENT_TEAM_ID} label="Other…" />
          </FormSelect>
        </FormGroup>

        {awayOther ? (
          <FormGroup label="Away team name" isRequired fieldId="am-away-name">
            <TextInput
              id="am-away-name"
              value={awayOtherName}
              validated={fieldErrors.away ? 'error' : 'default'}
              onChange={(_e, v) => {
                setAwayOtherName(v);
                setFieldErrors((current) => ({ ...current, away: false }));
              }}
              placeholder="Club or school name"
              aria-label="Away team name"
            />
          </FormGroup>
        ) : null}
      </div>

      <div className="rs-form-row rs-form-row--2">
        <FormGroup label="Date" isRequired fieldId="am-date">
          <TextInput
            id="am-date"
            type="date"
            value={date}
            onChange={(_e, v) => setDate(v)}
          />
        </FormGroup>

        <FormGroup label="Kickoff time" isRequired fieldId="am-time">
          <TextInput
            id="am-time"
            type="time"
            value={time}
            onChange={(_e, v) => setTime(v)}
          />
        </FormGroup>
      </div>

      <div className="rs-form-row rs-form-row--2">
        <FormGroup label="Venue name" isRequired fieldId="am-venue">
          <TextInput
            id="am-venue"
            value={venueName}
            onChange={(_e, v) => setVenueName(v)}
            placeholder="Field or complex name"
          />
        </FormGroup>

        <FormGroup label="Venue address" isRequired fieldId="am-address">
          <TextInput
            id="am-address"
            value={venueAddress}
            onChange={(_e, v) => setVenueAddress(v)}
            placeholder="Street, city, state, ZIP"
          />
        </FormGroup>
      </div>

      <div className="rs-form-row rs-form-row--3">
        <FormGroup label="Competition" fieldId="am-competition">
          <FormSelect
            id="am-competition"
            value={competition}
            onChange={(_e, v) => {
              setCompetition(v);
              // Drop club picks that are outside the newly selected conference.
              if (v.trim()) {
                const allowed = new Set(
                  rosterOptions
                    .filter((option) =>
                      competitionsEqual(option.conference, v),
                    )
                    .map((option) => option.id),
                );
                if (
                  homeTeamId &&
                  homeTeamId !== OTHER_OPPONENT_TEAM_ID &&
                  !allowed.has(homeTeamId)
                ) {
                  setHomeTeamId('');
                  setHomeOtherName('');
                }
                if (
                  awayTeamId &&
                  awayTeamId !== OTHER_OPPONENT_TEAM_ID &&
                  !allowed.has(awayTeamId)
                ) {
                  setAwayTeamId('');
                  setAwayOtherName('');
                }
              }
            }}
            aria-label="Competition"
          >
            <FormSelectOption value="" label="All conferences" />
            {competitions.map((c) => (
              <FormSelectOption key={c} value={c} label={c} />
            ))}
          </FormSelect>
        </FormGroup>

        <FormGroup label="Level" isRequired fieldId="am-level">
          <FormSelect
            id="am-level"
            value={level}
            onChange={(_e, v) => setLevel(v)}
            aria-label="Level"
          >
            {levels.map((l) => (
              <FormSelectOption key={l} value={l} label={l} />
            ))}
          </FormSelect>
        </FormGroup>

        <FormGroup label="Gender" isRequired fieldId="am-gender">
          <FormSelect
            id="am-gender"
            value={gender}
            onChange={(_e, v) => setGender(v === 'women' ? 'women' : 'men')}
            aria-label="Gender"
          >
            <FormSelectOption value="men" label="Men" />
            <FormSelectOption value="women" label="Women" />
          </FormSelect>
        </FormGroup>
      </div>

      <FormGroup label="Notes" fieldId="am-notes">
        <TextArea
          id="am-notes"
          value={notes}
          onChange={(_e, v) => setNotes(v)}
          rows={3}
          aria-label="Notes"
        />
      </FormGroup>

      <div className="rs-fixture-form__travel">
        <Checkbox
          id="am-flight"
          label={`Flight provided for referee (${REFEREE_TRAVEL_NOTE})`}
          isChecked={flightProvided}
          onChange={(_e, checked) => setFlightProvided(checked)}
        />
        <Checkbox
          id="am-housing"
          label={`Lodging provided for referee (${REFEREE_TRAVEL_NOTE})`}
          isChecked={housingProvided}
          onChange={(_e, checked) => setHousingProvided(checked)}
        />
      </div>

      {error && (
        <p className="rs-fixture-form__error" role="alert">
          {error}
        </p>
      )}

      <Button
        variant="primary"
        isDisabled={busy}
        isLoading={busy}
        onClick={() => void onSubmit()}
      >
        Add match
      </Button>
    </div>
  );
}
