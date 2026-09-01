import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import './onboarding.css';
import { Button, FormSelect, FormSelectOption, TextInput } from '@patternfly/react-core';
import { useNavigate } from 'react-router-dom';
import { defaultRoleView, ROLE_HOME, useApp } from '@/app/AppContext';
import { withDemoPrefix } from '@/app/demoPaths';
import {
  applyFanXorRoleToggle,
  guessNamesFromEmail,
  hasCompleteHomeAddress,
  readFileAsDataUrl,
  splitDisplayName,
  validateProfilePhoto,
} from '@/domain/profile';
import { normalizeEmail } from '@/domain/contacts';
import { conferenceTeamOptions } from '@/domain/teams';
import { dedupeTeamsForPicker } from '@/domain/teamList';
import { ConferenceTeamPicker } from '@/ui/ConferenceTeamPicker';
import { APPAREL_SIZES, type Role } from '@/domain/types';
import { isFirebaseConfigured } from '@/services/firebase';
import {
  callSubmitTeamLinkRequests,
  defaultOrgId,
} from '@/services/orgData';
import { saveFirebaseProfile } from '@/services/userProfile';
import { RefereeLevelChart } from '@/ui/RefereeLevelChart';

type StepId =
  | 'roles'
  | 'teams'
  | 'firstName'
  | 'lastName'
  | 'phone'
  | 'homeAddress'
  | 'birthday'
  | 'refereeLevel'
  | 'refereeingSince'
  | 'kitSizes'
  | 'favoriteTeams'
  | 'photo';

const ROLE_OPTIONS = [
  {
    id: 'official' as const,
    label: 'Referee',
    description: 'Crew, raise hand, match reports',
  },
  {
    id: 'teamAdmin' as const,
    label: 'Team Admin',
    description: 'Club confirmations for your team',
  },
  {
    id: 'cmo' as const,
    label: 'CMO',
    description: 'Coaching Match Official — includes Insights',
  },
  {
    id: 'fan' as const,
    label: 'Fan',
    description: 'Browse the schedule and who’s assigned',
  },
];

/** Stock rugby stills for step placeholders (from /img → public/img). */
const STEP_VISUALS: Partial<Record<StepId, string>> = {
  roles: '/img/onboard-4.jpg',
  teams: '/img/onboard-4.jpg',
  firstName: '/img/onboard-5.jpg',
  lastName: '/img/onboard-1.jpeg',
  phone: '/img/onboard-2.jpeg',
  homeAddress: '/img/onboard-3.jpeg',
  birthday: '/img/onboard-6.png',
  // refereeLevel uses RefereeLevelChart instead
  refereeingSince: '/img/onboard-5.jpg',
  kitSizes: '/img/onboard-1.jpeg',
  favoriteTeams: '/img/onboard-4.jpg',
  photo: '/img/onboard-3.jpeg',
};

const PHOTO_PLACEHOLDER = STEP_VISUALS.photo!;

export function OnboardingPage() {
  const { currentUser, store, dataMode, state, refreshLiveProfile } = useApp();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);

  const initialNames = useMemo(() => {
    if (!currentUser) return { firstName: '', lastName: '' };
    if (currentUser.firstName?.trim() || currentUser.lastName?.trim()) {
      return {
        firstName: currentUser.firstName ?? '',
        lastName: currentUser.lastName ?? '',
      };
    }
    if (currentUser.displayName?.trim()) {
      return splitDisplayName(currentUser.displayName);
    }
    if (currentUser.email) {
      return guessNamesFromEmail(currentUser.email);
    }
    return { firstName: '', lastName: '' };
  }, [currentUser]);

  const [stepIndex, setStepIndex] = useState(0);
  const [animKey, setAnimKey] = useState(0);
  const [firstName, setFirstName] = useState(initialNames.firstName);
  const [lastName, setLastName] = useState(initialNames.lastName);
  const [phone, setPhone] = useState(currentUser?.phone ?? '');
  const [homeStreet, setHomeStreet] = useState(
    currentUser?.homeStreet ?? '',
  );
  const [homeUnit, setHomeUnit] = useState(currentUser?.homeUnit ?? '');
  const [homeCity, setHomeCity] = useState(currentUser?.homeCity ?? '');
  const [homeRegion, setHomeRegion] = useState(
    currentUser?.homeRegion ?? '',
  );
  const [homePostalCode, setHomePostalCode] = useState(
    currentUser?.homePostalCode ?? '',
  );
  // Let the user choose deliberately — don't pre-check bootstrap roles.
  const [roleOfficial, setRoleOfficial] = useState(false);
  const [roleTeamAdmin, setRoleTeamAdmin] = useState(false);
  const [roleCmo, setRoleCmo] = useState(false);
  const [roleFan, setRoleFan] = useState(false);
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [fanFavoriteChoice, setFanFavoriteChoice] = useState(() => {
    const other = currentUser?.fanTeamOther?.trim();
    if (other) return 'other';
    const id = currentUser?.fanTeamIds?.[0];
    return id ?? 'general';
  });
  const [fanTeamOther, setFanTeamOther] = useState(
    () => currentUser?.fanTeamOther ?? '',
  );
  const [birthday, setBirthday] = useState(
    currentUser?.birthday?.slice(0, 10) ?? '',
  );
  const [refereeLevel, setRefereeLevel] = useState(
    currentUser?.refereeLevel != null ? String(currentUser.refereeLevel) : '',
  );
  const [levelUnknown, setLevelUnknown] = useState(false);
  const [refereeingSince, setRefereeingSince] = useState(
    yearFromStored(currentUser?.refereeingSince),
  );
  const [jerseySize, setJerseySize] = useState(currentUser?.jerseySize ?? '');
  const [shortsSize, setShortsSize] = useState(currentUser?.shortsSize ?? '');
  const [photoUrl, setPhotoUrl] = useState(currentUser?.photoUrl);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const needsRefDetails = roleOfficial || roleCmo;
  const needsWorkingFields = roleOfficial || roleTeamAdmin || roleCmo;
  const fanOnly = roleFan && !needsWorkingFields;

  const steps: StepId[] = useMemo(() => {
    if (fanOnly) {
      return ['roles', 'firstName', 'lastName', 'favoriteTeams', 'photo'];
    }
    const base: StepId[] = ['roles'];
    if (roleTeamAdmin) base.push('teams');
    base.push('firstName', 'lastName', 'phone');
    if (needsRefDetails) {
      base.push(
        'homeAddress',
        'refereeLevel',
        'refereeingSince',
        'kitSizes',
      );
    }
    base.push('birthday');
    if (roleFan) base.push('favoriteTeams');
    base.push('photo');
    return base;
  }, [fanOnly, needsRefDetails, roleFan, roleTeamAdmin]);

  const sortedTeams = useMemo(
    () =>
      dedupeTeamsForPicker(
        [...state.teams].sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
        ),
      ),
    [state.teams],
  );

  const teamPickerOptions = useMemo(
    () => conferenceTeamOptions(sortedTeams),
    [sortedTeams],
  );

  const autoSelectedTeamsRef = useRef(false);

  useEffect(() => {
    if (!roleTeamAdmin || !currentUser?.email?.trim() || autoSelectedTeamsRef.current) {
      return;
    }
    const email = normalizeEmail(currentUser.email);
    const matched = sortedTeams.filter((t) =>
      t.contactEmails.some((c) => normalizeEmail(c) === email),
    );
    if (matched.length === 0) return;
    autoSelectedTeamsRef.current = true;
    setSelectedTeamIds(matched.map((t) => t.id));
  }, [roleTeamAdmin, currentUser?.email, sortedTeams]);

  const safeIndex = Math.min(stepIndex, steps.length - 1);
  const step = steps[safeIndex]!;
  const progress = ((safeIndex + 1) / steps.length) * 100;

  useEffect(() => {
    if (stepIndex > steps.length - 1) {
      setStepIndex(steps.length - 1);
    }
  }, [stepIndex, steps.length]);

  useEffect(() => {
    if (
      step === 'photo' ||
      step === 'roles' ||
      step === 'teams' ||
      step === 'kitSizes' ||
      step === 'favoriteTeams'
    ) {
      return;
    }
    const t = window.setTimeout(() => inputRef.current?.focus(), 40);
    return () => window.clearTimeout(t);
  }, [step, animKey]);

  if (!currentUser) return null;

  const levelNum = Number(refereeLevel);
  const rolesOk = roleOfficial || roleTeamAdmin || roleCmo || roleFan;

  const fanFavoritePayload = (): {
    fanTeamIds: string[];
    fanTeamOther: string | undefined;
  } => {
    if (!roleFan) return { fanTeamIds: [], fanTeamOther: undefined };
    if (fanFavoriteChoice === 'general') {
      return { fanTeamIds: [], fanTeamOther: undefined };
    }
    if (fanFavoriteChoice === 'other') {
      return {
        fanTeamIds: [],
        fanTeamOther: fanTeamOther.trim() || undefined,
      };
    }
    return { fanTeamIds: [fanFavoriteChoice], fanTeamOther: undefined };
  };

  const stepValid = (): boolean => {
    switch (step) {
      case 'firstName':
        return Boolean(firstName.trim());
      case 'lastName':
        return Boolean(lastName.trim());
      case 'phone':
        return Boolean(phone.trim());
      case 'homeAddress':
        return hasCompleteHomeAddress({
          homeStreet,
          homeCity,
          homeRegion,
          homePostalCode,
        });
      case 'roles':
        return rolesOk;
      case 'teams':
        return selectedTeamIds.length > 0;
      case 'birthday':
        return Boolean(birthday.trim());
      case 'refereeLevel':
        return (
          levelUnknown ||
          (Number.isFinite(levelNum) && levelNum >= 1 && levelNum <= 20)
        );
      case 'refereeingSince':
        return isValidRefYear(refereeingSince);
      case 'kitSizes':
        return Boolean(jerseySize) && Boolean(shortsSize);
      case 'favoriteTeams':
        if (fanFavoriteChoice === 'other') {
          return Boolean(fanTeamOther.trim());
        }
        return true;
      case 'photo':
        return true;
      default:
        return false;
    }
  };

  const finish = () => {
    const roles: Role[] = [];
    if (roleOfficial) roles.push('official');
    if (roleTeamAdmin) roles.push('teamAdmin');
    if (roleCmo) roles.push('cmo');
    if (roleFan) roles.push('fan');
    if (currentUser.roles.includes('assigner')) roles.push('assigner');
    if (currentUser.roles.includes('reportAnalytics')) {
      roles.push('reportAnalytics');
    }
    if (currentUser.roles.includes('judicial')) roles.push('judicial');

    const favorite = fanFavoritePayload();

    const patch: Parameters<typeof store.updateProfile>[1] = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: currentUser.email.trim(),
      phone: fanOnly ? '' : phone.trim(),
      // SMS deferred — email notifications only for now.
      smsOptIn: false,
      roles,
      birthday: fanOnly ? undefined : birthday.trim(),
      photoUrl,
      fanTeamIds: favorite.fanTeamIds,
      fanTeamOther: favorite.fanTeamOther,
    };

    if (needsRefDetails) {
      patch.homeStreet = homeStreet.trim();
      patch.homeUnit = homeUnit.trim() || undefined;
      patch.homeCity = homeCity.trim();
      patch.homeRegion = homeRegion.trim();
      patch.homePostalCode = homePostalCode.trim();
      patch.refereeingSince = refereeingSince.trim();
      patch.jerseySize = jerseySize;
      patch.shortsSize = shortsSize;
      patch.refereeLevel = levelUnknown ? undefined : levelNum;
    } else {
      // Team Admin / Fan: no mileage address / kit.
      patch.homeStreet = '';
      patch.homeUnit = undefined;
      patch.homeCity = '';
      patch.homeRegion = '';
      patch.homePostalCode = '';
      patch.homeAddress = '';
      patch.refereeingSince = undefined;
      patch.jerseySize = undefined;
      patch.shortsSize = undefined;
      patch.refereeLevel = undefined;
    }

    store.updateProfile(currentUser.uid, {
      ...patch,
      teamIds: roleTeamAdmin ? [] : currentUser.teamIds,
    });
    let updated =
      store.getState().users.find((u) => u.uid === currentUser.uid) ??
      currentUser;

    void (async () => {
      if (isFirebaseConfigured && !currentUser.uid.startsWith('u_')) {
        setSaving(true);
        setSaveError(null);
        try {
          const saved = await saveFirebaseProfile(updated);
          store.updateProfile(currentUser.uid, saved);
          updated =
            store.getState().users.find((u) => u.uid === currentUser.uid) ??
            saved;
          if (roleTeamAdmin && selectedTeamIds.length > 0) {
            await callSubmitTeamLinkRequests({
              orgId: defaultOrgId(),
              teamIds: selectedTeamIds,
            });
          }
          await refreshLiveProfile();
        } catch (err) {
          setSaveError(
            err instanceof Error
              ? err.message
              : 'Could not save profile. Check your connection and try again.',
          );
          setSaving(false);
          return;
        }
        setSaving(false);
      } else if (roleTeamAdmin && selectedTeamIds.length > 0) {
        store.submitTeamLinkRequests(currentUser.uid, selectedTeamIds);
      }
      updated =
        store.getState().users.find((u) => u.uid === currentUser.uid) ??
        updated;
      navigate(
        dataMode === 'demo'
          ? withDemoPrefix(ROLE_HOME[defaultRoleView(updated)])
          : ROLE_HOME[defaultRoleView(updated)],
        { replace: true },
      );
    })();
  };

  const goNext = () => {
    if (!stepValid()) return;
    if (safeIndex >= steps.length - 1) {
      finish();
      return;
    }
    setStepIndex(safeIndex + 1);
    setAnimKey((k) => k + 1);
  };

  const goBack = () => {
    if (safeIndex <= 0) return;
    setStepIndex(safeIndex - 1);
    setAnimKey((k) => k + 1);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (
      e.key === 'Enter' &&
      stepValid() &&
      step !== 'roles' &&
      step !== 'homeAddress' &&
      step !== 'kitSizes' &&
      step !== 'photo' &&
      !(step === 'favoriteTeams' && fanFavoriteChoice !== 'other')
    ) {
      e.preventDefault();
      goNext();
    }
  };

  const onPickPhoto = async (file: File | undefined) => {
    setPhotoError(null);
    if (!file) return;
    const check = validateProfilePhoto(file);
    if (!check.ok) {
      setPhotoError(check.error);
      return;
    }
    try {
      setPhotoUrl(await readFileAsDataUrl(file));
    } catch {
      setPhotoError('Could not read that image.');
    }
  };

  const isLast = safeIndex >= steps.length - 1;
  const copy = stepCopy(step, firstName);
  const stepVisual = STEP_VISUALS[step];

  return (
    <div className="rs-onboard">
      <div
        className="rs-onboard__track"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={steps.length}
        aria-valuenow={safeIndex + 1}
        aria-label="Onboarding progress"
      >
        <div
          className="rs-onboard__track-fill"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div key={animKey} className="rs-onboard__panel" onKeyDown={onKeyDown}>
        <p className="rs-onboard__count">
          {safeIndex + 1} / {steps.length}
        </p>
        <h1 className="rs-onboard__question">{copy.title}</h1>
        {copy.hint && <p className="rs-onboard__hint">{copy.hint}</p>}
        {step !== 'photo' && stepVisual && (
          <div className="rs-onboard__visual" aria-hidden>
            <img src={stepVisual} alt="" className="rs-onboard__visual-img" />
          </div>
        )}

        <div className="rs-onboard__answer">
          {step === 'firstName' && (
            <TextInput
              ref={inputRef}
              id="ob-first"
              value={firstName}
              onChange={(_, v) => setFirstName(v)}
              autoComplete="given-name"
              aria-label="First name"
              className="rs-onboard__input"
            />
          )}
          {step === 'lastName' && (
            <TextInput
              ref={inputRef}
              id="ob-last"
              value={lastName}
              onChange={(_, v) => setLastName(v)}
              autoComplete="family-name"
              aria-label="Last name"
              className="rs-onboard__input"
            />
          )}
          {step === 'phone' && (
            <TextInput
              ref={inputRef}
              id="ob-phone"
              type="tel"
              value={phone}
              onChange={(_, v) => setPhone(v)}
              autoComplete="tel"
              aria-label="Phone"
              className="rs-onboard__input"
              placeholder="(555) 555-5555"
            />
          )}
          {step === 'homeAddress' && (
            <div className="rs-onboard__address">
              <TextInput
                ref={inputRef}
                id="ob-street"
                value={homeStreet}
                onChange={(_, v) => setHomeStreet(v)}
                autoComplete="address-line1"
                aria-label="Street address"
                className="rs-onboard__input"
                placeholder="Street address"
              />
              <TextInput
                id="ob-unit"
                value={homeUnit}
                onChange={(_, v) => setHomeUnit(v)}
                autoComplete="address-line2"
                aria-label="Apartment, suite, or unit"
                className="rs-onboard__input"
                placeholder="Apt, suite, unit (optional)"
              />
              <TextInput
                id="ob-city"
                value={homeCity}
                onChange={(_, v) => setHomeCity(v)}
                autoComplete="address-level2"
                aria-label="City"
                className="rs-onboard__input"
                placeholder="City"
              />
              <div className="rs-onboard__address-row">
                <TextInput
                  id="ob-region"
                  value={homeRegion}
                  onChange={(_, v) => setHomeRegion(v)}
                  autoComplete="address-level1"
                  aria-label="State"
                  className="rs-onboard__input"
                  placeholder="State"
                />
                <TextInput
                  id="ob-postal"
                  value={homePostalCode}
                  onChange={(_, v) => setHomePostalCode(v)}
                  autoComplete="postal-code"
                  aria-label="ZIP code"
                  className="rs-onboard__input"
                  placeholder="ZIP"
                />
              </div>
            </div>
          )}
          {step === 'roles' && (
            <div className="rs-onboard__choices" role="group" aria-label="Roles">
              {ROLE_OPTIONS.map((r) => {
                const checked =
                  r.id === 'official'
                    ? roleOfficial
                    : r.id === 'teamAdmin'
                      ? roleTeamAdmin
                      : r.id === 'cmo'
                        ? roleCmo
                        : roleFan;
                const workingSelected =
                  roleOfficial || roleTeamAdmin || roleCmo;
                const disabled =
                  (r.id === 'fan' && workingSelected && !roleFan) ||
                  (r.id !== 'fan' && roleFan && !checked);
                return (
                  <button
                    key={r.id}
                    type="button"
                    className={`rs-onboard__choice rs-onboard__choice--multi${
                      checked ? ' rs-onboard__choice--selected' : ''
                    }${disabled ? ' rs-onboard__choice--disabled' : ''}`}
                    aria-pressed={checked}
                    aria-disabled={disabled || undefined}
                    disabled={disabled}
                    onClick={() => {
                      if (disabled) return;
                      const next = applyFanXorRoleToggle(
                        {
                          roleOfficial,
                          roleTeamAdmin,
                          roleCmo,
                          roleFan,
                        },
                        r.id,
                        !checked,
                      );
                      setRoleOfficial(next.roleOfficial);
                      setRoleTeamAdmin(next.roleTeamAdmin);
                      setRoleCmo(next.roleCmo);
                      setRoleFan(next.roleFan);
                      if (!next.roleTeamAdmin) setSelectedTeamIds([]);
                    }}
                  >
                    <span
                      className={`rs-onboard__check${
                        checked ? ' rs-onboard__check--on' : ''
                      }`}
                      aria-hidden
                    >
                      {checked ? (
                        <svg viewBox="0 0 20 20" width="14" height="14">
                          <path
                            fill="currentColor"
                            d="M7.6 13.2 4.4 10l-1.2 1.2 4.4 4.4L17 6.2 15.8 5z"
                          />
                        </svg>
                      ) : null}
                    </span>
                    <span className="rs-onboard__choice-text">
                      <strong>{r.label}</strong>
                      <span>{r.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          {step === 'teams' && (
            <div className="rs-onboard__team-picker">
              {teamPickerOptions.length === 0 ? (
                <p className="rs-onboard__hint">
                  No clubs are in the schedule yet. Ask your Scheduler to sync
                  the Sheet, then return to finish linking.
                </p>
              ) : (
                <ConferenceTeamPicker
                  options={teamPickerOptions}
                  selectedIds={selectedTeamIds}
                  onChange={setSelectedTeamIds}
                  ariaLabel="Select clubs by conference"
                />
              )}
            </div>
          )}
          {step === 'favoriteTeams' && (
            <div className="rs-onboard__favorite">
              <FormSelect
                id="ob-fan-favorite"
                value={fanFavoriteChoice}
                onChange={(_, v) => {
                  setFanFavoriteChoice(v);
                  if (v !== 'other') setFanTeamOther('');
                }}
                aria-label="Favorite team"
                className="rs-onboard__input"
              >
                <FormSelectOption value="general" label="General (whole society)" />
                {[...state.teams]
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((t) => (
                    <FormSelectOption key={t.id} value={t.id} label={t.name} />
                  ))}
                <FormSelectOption value="other" label="Other" />
              </FormSelect>
              {fanFavoriteChoice === 'other' && (
                <TextInput
                  ref={inputRef}
                  id="ob-fan-other"
                  value={fanTeamOther}
                  onChange={(_, v) => setFanTeamOther(v)}
                  aria-label="Other team name"
                  className="rs-onboard__input"
                  placeholder="Team name"
                />
              )}
            </div>
          )}
          {step === 'birthday' && (
            <TextInput
              ref={inputRef}
              id="ob-bday"
              type="date"
              value={birthday}
              onChange={(_, v) => setBirthday(v)}
              aria-label="Birthday"
              className="rs-onboard__input"
            />
          )}
          {step === 'refereeLevel' && (
            <div className="rs-onboard__level">
              <RefereeLevelChart
                caption="Match yourself to a column, or choose “I don’t know” and add your grade later in Profile. Tap the chart to enlarge."
              />
              <TextInput
                ref={inputRef}
                id="ob-level"
                type="number"
                min={1}
                max={20}
                value={levelUnknown ? '' : refereeLevel}
                isDisabled={levelUnknown}
                onChange={(_, v) => {
                  setLevelUnknown(false);
                  setRefereeLevel(v);
                }}
                aria-label="Referee level"
                className="rs-onboard__input"
                placeholder="e.g. 8"
              />
              <button
                type="button"
                className={`rs-onboard__choice rs-onboard__choice--multi${
                  levelUnknown ? ' rs-onboard__choice--selected' : ''
                }`}
                aria-pressed={levelUnknown}
                onClick={() => {
                  setLevelUnknown(true);
                  setRefereeLevel('');
                }}
              >
                <span
                  className={`rs-onboard__check${
                    levelUnknown ? ' rs-onboard__check--on' : ''
                  }`}
                  aria-hidden
                >
                  {levelUnknown ? (
                    <svg viewBox="0 0 20 20" width="14" height="14">
                      <path
                        fill="currentColor"
                        d="M7.6 13.2 4.4 10l-1.2 1.2 4.4 4.4L17 6.2 15.8 5z"
                      />
                    </svg>
                  ) : null}
                </span>
                <span className="rs-onboard__choice-text">
                  <strong>I don’t know</strong>
                  <span>You can add your grade later in Profile</span>
                </span>
              </button>
            </div>
          )}
          {step === 'refereeingSince' && (
            <TextInput
              ref={inputRef}
              id="ob-since"
              type="number"
              inputMode="numeric"
              min={1950}
              max={new Date().getFullYear()}
              value={refereeingSince}
              onChange={(_, v) => setRefereeingSince(v.replace(/\D/g, '').slice(0, 4))}
              aria-label="Year you started refereeing"
              className="rs-onboard__input"
              placeholder="e.g. 2018"
            />
          )}
          {step === 'kitSizes' && (
            <div className="rs-onboard__kit">
              <p className="rs-onboard__kit-label">Jersey</p>
              <div className="rs-onboard__sizes" role="group" aria-label="Jersey size">
                {APPAREL_SIZES.map((s) => (
                  <button
                    key={`j-${s}`}
                    type="button"
                    className={`rs-onboard__size${
                      jerseySize === s ? ' rs-onboard__size--selected' : ''
                    }`}
                    aria-pressed={jerseySize === s}
                    onClick={() => setJerseySize(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <p className="rs-onboard__kit-label">Shorts</p>
              <div className="rs-onboard__sizes" role="group" aria-label="Shorts size">
                {APPAREL_SIZES.map((s) => (
                  <button
                    key={`s-${s}`}
                    type="button"
                    className={`rs-onboard__size${
                      shortsSize === s ? ' rs-onboard__size--selected' : ''
                    }`}
                    aria-pressed={shortsSize === s}
                    onClick={() => setShortsSize(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {step === 'photo' && (
            <div className="rs-onboard__photo">
              <div className="rs-onboard__photo-preview">
                {photoUrl ? (
                  <img src={photoUrl} alt="" />
                ) : (
                  <img
                    src={PHOTO_PLACEHOLDER}
                    alt=""
                    className="rs-onboard__photo-preview-placeholder"
                  />
                )}
              </div>
              <input
                ref={photoRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                onChange={(e) => {
                  void onPickPhoto(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
              <div className="rs-onboard__photo-actions">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => photoRef.current?.click()}
                >
                  {photoUrl ? 'Change photo' : 'Add photo'}
                </Button>
                {photoUrl && (
                  <Button
                    type="button"
                    variant="link"
                    onClick={() => {
                      setPhotoUrl(undefined);
                      setPhotoError(null);
                    }}
                  >
                    Remove
                  </Button>
                )}
              </div>
              <p className="rs-onboard__hint">JPEG, PNG, or WebP · under 5 MB</p>
              {photoError && (
                <p className="rs-profile-photo__error" role="alert">
                  {photoError}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="rs-onboard__nav">
          {safeIndex > 0 ? (
            <button type="button" className="rs-onboard__back" onClick={goBack}>
              Back
            </button>
          ) : (
            <span />
          )}
          <div className="rs-onboard__nav-end">
            {step === 'photo' && (
              <Button
                type="button"
                variant="link"
                isDisabled={saving}
                onClick={finish}
              >
                Skip
              </Button>
            )}
            <Button
              type="button"
              variant="primary"
              isDisabled={!stepValid() || saving}
              isLoading={saving}
              onClick={goNext}
            >
              {isLast ? 'Finish' : 'Continue'}
            </Button>
          </div>
        </div>
        {saveError && (
          <p className="rs-match-card__meta" role="alert">
            {saveError}
          </p>
        )}
        {step !== 'roles' &&
          step !== 'homeAddress' &&
          step !== 'kitSizes' &&
          step !== 'photo' &&
          step !== 'refereeLevel' && (
            <p className="rs-onboard__enter">Press Enter to continue</p>
          )}
      </div>
    </div>
  );
}

function yearFromStored(value: string | undefined): string {
  if (!value?.trim()) return '';
  const y = value.trim().slice(0, 4);
  return /^\d{4}$/.test(y) ? y : '';
}

function isValidRefYear(value: string): boolean {
  if (!/^\d{4}$/.test(value.trim())) return false;
  const y = Number(value);
  const now = new Date().getFullYear();
  return y >= 1950 && y <= now;
}

function stepCopy(
  step: StepId,
  firstName: string,
): { title: string; hint?: string } {
  const name = firstName.trim() || 'there';
  switch (step) {
    case 'roles':
      return {
        title: 'How will you use MatchReadyTX?',
        hint: 'Select all that apply. Scheduler access is granted by your society.',
      };
    case 'teams':
      return {
        title: 'Which clubs do you manage?',
        hint: 'Pick under Lone Star Men and/or Lone Star Women — each side is separate. If your email is already on Contacts, you’re approved automatically; otherwise your Scheduler or a current Team Admin reviews each request.',
      };
    case 'firstName':
      return { title: 'What’s your first name?' };
    case 'lastName':
      return { title: 'And your last name?' };
    case 'phone':
      return {
        title: `What’s your phone number, ${name}?`,
        hint: 'Required for contact. Alerts go to email for now.',
      };
    case 'homeAddress':
      return {
        title: 'What’s your home address?',
        hint: 'Used for round-trip mileage for referees and CMOs. Include apt/suite if you have one.',
      };
    case 'refereeLevel':
      return {
        title: 'What’s your referee level?',
        hint: 'Most refs aren’t sure at first — use the chart, or pick “I don’t know.”',
      };
    case 'refereeingSince':
      return {
        title: 'What year did you start refereeing?',
        hint: 'Just the year is fine.',
      };
    case 'kitSizes':
      return {
        title: 'Jersey & shorts size?',
        hint: 'For referee/CMO kit orders.',
      };
    case 'favoriteTeams':
      return {
        title: 'Any favorite team?',
        hint: 'Pick one club, General for the full schedule, or Other to type a name.',
      };
    case 'birthday':
      return {
        title: 'When’s your birthday?',
        hint: 'Used for age-related kit and society records.',
      };
    case 'photo':
      return {
        title: 'Add a profile photo?',
        hint: 'Optional — helps assigners recognize you. You can skip.',
      };
  }
}
