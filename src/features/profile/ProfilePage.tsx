import { useMemo, useRef, useState } from 'react';
import {
  Button,
  Checkbox,
  Form,
  FormGroup,
  FormHelperText,
  FormSelect,
  FormSelectOption,
  HelperText,
  HelperTextItem,
  TextInput,
  Title,
} from '@patternfly/react-core';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/app/AppContext';
import {
  applyFanXorRoleToggle,
  hasCompleteHomeAddress,
  readFileAsDataUrl,
  validateProfilePhoto,
} from '@/domain/profile';
import {
  APPAREL_SIZES,
  ASSESSED_LEVEL_MAX,
  ASSESSED_LEVEL_MIN,
  hasRefereeLensRole,
  type Role,
} from '@/domain/types';
import {
  MAX_TEAM_ADMIN_CLUB_REQUEST_BATCH,
  validateTeamLinkRequestBatch,
} from '@/domain/teamLinkRequests';
import { conferenceTeamOptions } from '@/domain/teams';
import { dedupeTeamsForPicker } from '@/domain/teamList';
import { OfficialInsightsPanel } from '@/features/scheduler/OfficialInsightsPanel';
import { isFirebaseConfigured } from '@/services/firebase';
import {
  callSubmitTeamLinkRequests,
  defaultOrgId,
} from '@/services/orgData';
import { saveFirebaseProfile } from '@/services/userProfile';
import { saveAssessedLevelRequest } from '@/services/orgMembers';
import { RefereeLevelChart } from '@/ui/RefereeLevelChart';
import {
  ConferenceTeamPicker,
} from '@/ui/ConferenceTeamPicker';
import { UserAvatar } from '@/ui/UserAvatar';

export function ProfilePage() {
  const {
    currentUser,
    store,
    signOut,
    state,
    hasInsightsAccess,
    isAssignerView,
  } = useApp();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  const [firstName, setFirstName] = useState(currentUser?.firstName ?? '');
  const [lastName, setLastName] = useState(currentUser?.lastName ?? '');
  const email = currentUser?.email ?? '';
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
  const [roleOfficial, setRoleOfficial] = useState(
    Boolean(currentUser?.roles.includes('official')),
  );
  const [roleTeamAdmin, setRoleTeamAdmin] = useState(
    Boolean(currentUser?.roles.includes('teamAdmin')),
  );
  const [roleCmo, setRoleCmo] = useState(
    Boolean(currentUser?.roles.includes('cmo')),
  );
  const [roleFan, setRoleFan] = useState(
    Boolean(currentUser?.roles.includes('fan')),
  );
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
  const [levelUnknown, setLevelUnknown] = useState(
    Boolean(
      (currentUser?.roles.includes('official') ||
        currentUser?.roles.includes('cmo')) &&
        currentUser?.refereeLevel == null,
    ),
  );
  const [refereeingSince, setRefereeingSince] = useState(() => {
    const raw = currentUser?.refereeingSince?.trim() ?? '';
    const y = raw.slice(0, 4);
    return /^\d{4}$/.test(y) ? y : '';
  });
  const [jerseySize, setJerseySize] = useState(currentUser?.jerseySize ?? '');
  const [shortsSize, setShortsSize] = useState(currentUser?.shortsSize ?? '');
  const [photoUrl, setPhotoUrl] = useState(currentUser?.photoUrl);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [profileTab, setProfileTab] = useState<'profile' | 'insights'>('profile');
  const [requestLevelDraft, setRequestLevelDraft] = useState('');
  const [requestLevelBusy, setRequestLevelBusy] = useState(false);
  const [requestLevelNote, setRequestLevelNote] = useState<string | null>(null);
  const [requestTeamIds, setRequestTeamIds] = useState<string[]>([]);
  const [linkNote, setLinkNote] = useState<string | null>(null);
  const [linkBusy, setLinkBusy] = useState(false);

  const sortedTeams = useMemo(
    () =>
      dedupeTeamsForPicker(
        [...state.teams].sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
        ),
      ),
    [state.teams],
  );

  if (!currentUser) return null;

  const showInsightsTab = hasRefereeLensRole(currentUser.roles);
  const showSchedulerCoachFeedback = hasInsightsAccess && isAssignerView;

  const needsRefDetails = roleOfficial || roleCmo;
  const needsWorkingFields = roleOfficial || roleTeamAdmin || roleCmo;
  const fanOnly = roleFan && !needsWorkingFields;
  const levelNum = Number(refereeLevel);
  const rolesOk = roleOfficial || roleTeamAdmin || roleCmo || roleFan;

  const myPendingLinks = state.teamLinkRequests.filter(
    (r) =>
      r.requesterUserId === currentUser.uid &&
      (r.status === 'pending' || r.status === 'denied'),
  );

  const requestableTeams = sortedTeams.filter(
    (t) =>
      !currentUser.teamIds.includes(t.id) &&
      !state.teamLinkRequests.some(
        (r) =>
          r.requesterUserId === currentUser.uid &&
          r.teamId === t.id &&
          r.status === 'pending',
      ),
  );
  const requestableTeamOptions = useMemo(
    () =>
      conferenceTeamOptions(
        sortedTeams,
        new Set(requestableTeams.map((team) => team.id)),
      ),
    [requestableTeams, sortedTeams],
  );
  const levelOk =
    levelUnknown ||
    (Number.isFinite(levelNum) && levelNum >= 1 && levelNum <= 20);
  const fanFavoriteOk =
    !roleFan ||
    fanFavoriteChoice !== 'other' ||
    Boolean(fanTeamOther.trim());
  const canSave =
    Boolean(firstName.trim()) &&
    Boolean(lastName.trim()) &&
    Boolean(email.trim()) &&
    rolesOk &&
    fanFavoriteOk &&
    (fanOnly
      ? true
      : Boolean(phone.trim()) &&
        (needsRefDetails
          ? Boolean(birthday.trim()) &&
            hasCompleteHomeAddress({
              homeStreet,
              homeCity,
              homeRegion,
              homePostalCode,
            }) &&
            levelOk &&
            /^\d{4}$/.test(refereeingSince.trim()) &&
            Number(refereeingSince) >= 1950 &&
            Number(refereeingSince) <= new Date().getFullYear() &&
            Boolean(jerseySize) &&
            Boolean(shortsSize)
          : true));

  const onPickPhoto = async (file: File | undefined) => {
    setPhotoError(null);
    if (!file) return;
    const check = validateProfilePhoto(file);
    if (!check.ok) {
      setPhotoError(check.error);
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setPhotoUrl(dataUrl);
    } catch {
      setPhotoError('Could not read that image.');
    }
  };

  const save = () => {
    if (!canSave) return;
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

    let nextFanTeamIds: string[] = [];
    let nextFanTeamOther: string | undefined;
    if (roleFan) {
      if (fanFavoriteChoice === 'other') {
        nextFanTeamOther = fanTeamOther.trim() || undefined;
      } else if (fanFavoriteChoice !== 'general') {
        nextFanTeamIds = [fanFavoriteChoice];
      }
    }

    const patch: Parameters<typeof store.updateProfile>[1] = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim(),
      phone: fanOnly ? '' : phone.trim(),
      // SMS deferred — keep false until we ship SMS again.
      smsOptIn: false,
      roles,
      birthday: fanOnly ? undefined : birthday.trim(),
      photoUrl,
      fanTeamIds: nextFanTeamIds,
      fanTeamOther: nextFanTeamOther,
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
    store.updateProfile(currentUser.uid, patch);
    const updated =
      store.getState().users.find((u) => u.uid === currentUser.uid) ??
      currentUser;
    if (isFirebaseConfigured && !currentUser.uid.startsWith('u_')) {
      void saveFirebaseProfile(updated).catch((err) => {
        console.error('Failed to persist profile', err);
      });
    }
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1600);
  };

  const submitLevelRequest = async () => {
    const trimmed = requestLevelDraft.trim();
    if (!trimmed) {
      setRequestLevelNote(`Enter a level from ${ASSESSED_LEVEL_MIN}–${ASSESSED_LEVEL_MAX}.`);
      return;
    }
    const n = Number(trimmed);
    if (
      !Number.isFinite(n) ||
      n < ASSESSED_LEVEL_MIN ||
      n > ASSESSED_LEVEL_MAX
    ) {
      setRequestLevelNote(
        `Level must be between ${ASSESSED_LEVEL_MIN} and ${ASSESSED_LEVEL_MAX}.`,
      );
      return;
    }
    setRequestLevelBusy(true);
    setRequestLevelNote(null);
    try {
      store.updateProfile(currentUser.uid, { requestedAssessedLevel: n });
      if (isFirebaseConfigured && !currentUser.uid.startsWith('u_')) {
        await saveAssessedLevelRequest(currentUser.uid, n);
      }
      setRequestLevelNote('Level request sent to your scheduler for review.');
    } catch (err) {
      setRequestLevelNote(
        err instanceof Error ? err.message : 'Could not submit level request.',
      );
    } finally {
      setRequestLevelBusy(false);
    }
  };

  const withdrawLevelRequest = async () => {
    setRequestLevelBusy(true);
    setRequestLevelNote(null);
    try {
      store.updateProfile(currentUser.uid, { requestedAssessedLevel: undefined });
      if (isFirebaseConfigured && !currentUser.uid.startsWith('u_')) {
        await saveAssessedLevelRequest(currentUser.uid, null);
      }
      setRequestLevelDraft('');
      setRequestLevelNote('Level request withdrawn.');
    } catch (err) {
      setRequestLevelNote(
        err instanceof Error ? err.message : 'Could not withdraw request.',
      );
    } finally {
      setRequestLevelBusy(false);
    }
  };

  const submitClubLinks = async () => {
    if (!roleTeamAdmin || requestTeamIds.length === 0) return;
    const validated = validateTeamLinkRequestBatch(requestTeamIds);
    if (!validated.ok) {
      setLinkNote(validated.error);
      return;
    }
    setLinkBusy(true);
    setLinkNote(null);
    try {
      if (isFirebaseConfigured && !currentUser.uid.startsWith('u_')) {
        const result = await callSubmitTeamLinkRequests({
          orgId: defaultOrgId(),
          teamIds: validated.value,
        });
        setLinkNote(
          [
            result.autoApproved.length
              ? `Approved: ${result.autoApproved.length}`
              : null,
            result.pending.length
              ? `Pending review: ${result.pending.length}`
              : null,
          ]
            .filter(Boolean)
            .join(' · ') || 'Submitted.',
        );
      } else {
        const result = store.submitTeamLinkRequests(
          currentUser.uid,
          validated.value,
        );
        setLinkNote(
          [
            result.autoApproved.length
              ? `Approved: ${result.autoApproved.length}`
              : null,
            result.pending.length
              ? `Pending review: ${result.pending.length}`
              : null,
          ]
            .filter(Boolean)
            .join(' · ') || 'Submitted.',
        );
      }
      setRequestTeamIds([]);
    } catch (err) {
      setLinkNote(
        err instanceof Error ? err.message : 'Could not submit club requests.',
      );
    } finally {
      setLinkBusy(false);
    }
  };

  const previewUser = {
    firstName,
    lastName,
    displayName: `${firstName} ${lastName}`.trim() || currentUser.displayName,
    photoUrl,
  };

  return (
    <div className="rs-stack">
      <Title headingLevel="h1">Profile</Title>
      {showInsightsTab && (
        <nav className="rs-inline-tabs" aria-label="Profile">
          <button
            type="button"
            className={
              profileTab === 'profile'
                ? 'rs-inline-tabs__tab active'
                : 'rs-inline-tabs__tab'
            }
            aria-current={profileTab === 'profile' ? 'page' : undefined}
            onClick={() => setProfileTab('profile')}
          >
            Edit profile
          </button>
          <button
            type="button"
            className={
              profileTab === 'insights'
                ? 'rs-inline-tabs__tab active'
                : 'rs-inline-tabs__tab'
            }
            aria-current={profileTab === 'insights' ? 'page' : undefined}
            onClick={() => setProfileTab('insights')}
          >
            Insights
          </button>
        </nav>
      )}
      {profileTab === 'insights' && showInsightsTab ? (
        <OfficialInsightsPanel
          userId={currentUser.uid}
          showCoachFeedback={showSchedulerCoachFeedback}
        />
      ) : (
      <Form className="rs-profile-form">
        <FormGroup label="Photo" fieldId="pf-photo">
          <div className="rs-profile-photo">
            <UserAvatar user={previewUser} />
            <div className="rs-profile-photo__actions">
              <input
                ref={fileRef}
                id="pf-photo"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                onChange={(e) => {
                  void onPickPhoto(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
              <Button
                type="button"
                variant="secondary"
                onClick={() => fileRef.current?.click()}
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
          </div>
          <FormHelperText>
            <HelperText>
              <HelperTextItem>JPEG, PNG, or WebP · under 5 MB</HelperTextItem>
            </HelperText>
          </FormHelperText>
          {photoError && (
            <p className="rs-profile-photo__error" role="alert">
              {photoError}
            </p>
          )}
        </FormGroup>

        <div className="rs-form-row rs-form-row--2">
          <FormGroup label="First name" isRequired>
            <TextInput
              value={firstName}
              onChange={(_, v) => setFirstName(v)}
              autoComplete="given-name"
            />
          </FormGroup>
          <FormGroup label="Last name" isRequired>
            <TextInput
              value={lastName}
              onChange={(_, v) => setLastName(v)}
              autoComplete="family-name"
            />
          </FormGroup>
        </div>
        <div className="rs-form-row rs-form-row--2">
          <FormGroup label="Email">
            <TextInput
              type="email"
              value={email}
              isDisabled
              readOnly
              autoComplete="email"
            />
          </FormGroup>
          {!fanOnly && (
            <FormGroup label="Phone" isRequired>
              <TextInput
                type="tel"
                value={phone}
                onChange={(_, v) => setPhone(v)}
                autoComplete="tel"
              />
            </FormGroup>
          )}
        </div>
        <FormHelperText>
          <HelperText>
            <HelperTextItem>
              Email comes from your Google or Apple sign-in. Alerts go to email
              for now.
            </HelperTextItem>
          </HelperText>
        </FormHelperText>

        <FormGroup label="How you use MatchReadyTX" isRequired>
          <div className="rs-onboarding__roles">
            <Checkbox
              id="pf-role-official"
              label="Referee"
              isChecked={roleOfficial}
              isDisabled={roleFan}
              onChange={(_, v) => {
                const next = applyFanXorRoleToggle(
                  {
                    roleOfficial,
                    roleTeamAdmin,
                    roleCmo,
                    roleFan,
                  },
                  'official',
                  v,
                );
                setRoleOfficial(next.roleOfficial);
                setRoleTeamAdmin(next.roleTeamAdmin);
                setRoleCmo(next.roleCmo);
                setRoleFan(next.roleFan);
              }}
            />
            <Checkbox
              id="pf-role-team"
              label="Team Admin"
              isChecked={roleTeamAdmin}
              isDisabled={roleFan}
              onChange={(_, v) => {
                const next = applyFanXorRoleToggle(
                  {
                    roleOfficial,
                    roleTeamAdmin,
                    roleCmo,
                    roleFan,
                  },
                  'teamAdmin',
                  v,
                );
                setRoleOfficial(next.roleOfficial);
                setRoleTeamAdmin(next.roleTeamAdmin);
                setRoleCmo(next.roleCmo);
                setRoleFan(next.roleFan);
              }}
            />
            <Checkbox
              id="pf-role-cmo"
              label="CMO"
              isChecked={roleCmo}
              isDisabled={roleFan}
              onChange={(_, v) => {
                const next = applyFanXorRoleToggle(
                  {
                    roleOfficial,
                    roleTeamAdmin,
                    roleCmo,
                    roleFan,
                  },
                  'cmo',
                  v,
                );
                setRoleOfficial(next.roleOfficial);
                setRoleTeamAdmin(next.roleTeamAdmin);
                setRoleCmo(next.roleCmo);
                setRoleFan(next.roleFan);
              }}
            />
            <Checkbox
              id="pf-role-fan"
              label="Fan"
              isChecked={roleFan}
              isDisabled={
                (roleOfficial || roleTeamAdmin || roleCmo) && !roleFan
              }
              onChange={(_, v) => {
                const next = applyFanXorRoleToggle(
                  {
                    roleOfficial,
                    roleTeamAdmin,
                    roleCmo,
                    roleFan,
                  },
                  'fan',
                  v,
                );
                setRoleOfficial(next.roleOfficial);
                setRoleTeamAdmin(next.roleTeamAdmin);
                setRoleCmo(next.roleCmo);
                setRoleFan(next.roleFan);
              }}
            />
          </div>
          <FormHelperText>
            <HelperText>
              <HelperTextItem>
                Fan is browse-only and cannot be combined with Referee, Team
                Admin, or CMO. Checking CMO also unlocks the Insights tab.
              </HelperTextItem>
            </HelperText>
          </FormHelperText>
          {currentUser.roles.includes('assigner') && (
            <FormHelperText>
              <HelperText>
                <HelperTextItem>
                  Scheduler access is granted by your org and cannot be removed
                  here.
                </HelperTextItem>
              </HelperText>
            </FormHelperText>
          )}
          {(currentUser.roles.includes('judicial') ||
            currentUser.roles.includes('reportAnalytics')) && (
            <FormHelperText>
              <HelperText>
                <HelperTextItem>
                  Judicial and Insights access are granted by Scheduler or
                  Judicial officers and cannot be changed here.
                </HelperTextItem>
              </HelperText>
            </FormHelperText>
          )}
        </FormGroup>

        {roleTeamAdmin && (
          <FormGroup label="Clubs you manage">
            {currentUser.teamIds.length > 0 ? (
              <ul className="rs-member-teams">
                {currentUser.teamIds.map((id) => {
                  const t = state.teams.find((x) => x.id === id);
                  return <li key={id}>{t?.name ?? id}</li>;
                })}
              </ul>
            ) : (
              <p className="rs-match-card__meta">
                No clubs linked yet. Select sides below — Contacts email
                auto-approves; otherwise wait for Scheduler / Team Admin review.
                Browse as Fan until approved.
              </p>
            )}
            {myPendingLinks.length > 0 && (
              <ul className="rs-match-card__meta">
                {myPendingLinks.map((r) => (
                  <li key={r.id}>
                    {r.teamName}: {r.status}
                    {r.denyReason ? ` — ${r.denyReason}` : ''}
                  </li>
                ))}
              </ul>
            )}
            {requestableTeams.length > 0 && (
              <>
                <ConferenceTeamPicker
                  options={requestableTeamOptions}
                  selectedIds={requestTeamIds}
                  onChange={setRequestTeamIds}
                  ariaLabel="Request clubs by conference"
                  limitMessage={
                    requestTeamIds.length >= MAX_TEAM_ADMIN_CLUB_REQUEST_BATCH
                      ? `You can request up to ${MAX_TEAM_ADMIN_CLUB_REQUEST_BATCH} clubs at a time. Deselect one to choose another.`
                      : null
                  }
                />
                <Button
                  variant="secondary"
                  isDisabled={requestTeamIds.length === 0 || linkBusy}
                  isLoading={linkBusy}
                  onClick={() => void submitClubLinks()}
                >
                  Request selected clubs
                </Button>
              </>
            )}
            {linkNote && (
              <p className="rs-match-card__meta" role="status">
                {linkNote}
              </p>
            )}
          </FormGroup>
        )}

        {roleFan && (
          <FormGroup label="Favorite team">
            <FormSelect
              id="pf-fan-favorite"
              value={fanFavoriteChoice}
              onChange={(_, v) => {
                setFanFavoriteChoice(v);
                if (v !== 'other') setFanTeamOther('');
              }}
              aria-label="Favorite team"
            >
              <FormSelectOption
                value="general"
                label="General (whole society)"
              />
              {[...state.teams]
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((t) => (
                  <FormSelectOption key={t.id} value={t.id} label={t.name} />
                ))}
              <FormSelectOption value="other" label="Other" />
            </FormSelect>
            {fanFavoriteChoice === 'other' && (
              <TextInput
                className="pf-v6-u-mt-sm"
                value={fanTeamOther}
                onChange={(_, v) => setFanTeamOther(v)}
                aria-label="Other team name"
                placeholder="Team name"
              />
            )}
            <FormHelperText>
              <HelperText>
                <HelperTextItem>
                  Used to filter League schedule when you pick a listed club.
                </HelperTextItem>
              </HelperText>
            </FormHelperText>
          </FormGroup>
        )}

        {!fanOnly && (
          <FormGroup label="Birthday" isRequired>
            <TextInput
              type="date"
              value={birthday}
              onChange={(_, v) => setBirthday(v)}
            />
          </FormGroup>
        )}

        {needsRefDetails && (
          <>
            <div className="rs-form-row rs-form-row--2">
              <FormGroup label="Street address" isRequired>
                <TextInput
                  value={homeStreet}
                  onChange={(_, v) => setHomeStreet(v)}
                  autoComplete="address-line1"
                  placeholder="123 Main St"
                />
              </FormGroup>
              <FormGroup label="Apt / suite / unit">
                <TextInput
                  value={homeUnit}
                  onChange={(_, v) => setHomeUnit(v)}
                  autoComplete="address-line2"
                  placeholder="Optional"
                />
              </FormGroup>
            </div>
            <div className="rs-form-row rs-form-row--3">
              <FormGroup label="City" isRequired>
                <TextInput
                  value={homeCity}
                  onChange={(_, v) => setHomeCity(v)}
                  autoComplete="address-level2"
                />
              </FormGroup>
              <FormGroup label="State" isRequired>
                <TextInput
                  value={homeRegion}
                  onChange={(_, v) => setHomeRegion(v)}
                  autoComplete="address-level1"
                />
              </FormGroup>
              <FormGroup label="ZIP" isRequired>
                <TextInput
                  value={homePostalCode}
                  onChange={(_, v) => setHomePostalCode(v)}
                  autoComplete="postal-code"
                />
              </FormGroup>
            </div>
            <FormHelperText>
              <HelperText>
                <HelperTextItem>
                  Home address for referee/CMO mileage estimates.
                </HelperTextItem>
              </HelperText>
            </FormHelperText>

            <FormGroup label="Referee level">
              <RefereeLevelChart className="rs-profile-level-chart" />
              <TextInput
                type="number"
                min={1}
                max={20}
                value={levelUnknown ? '' : refereeLevel}
                isDisabled={levelUnknown}
                onChange={(_, v) => {
                  setLevelUnknown(false);
                  setRefereeLevel(v);
                }}
              />
              <Checkbox
                id="pf-level-unknown"
                className="pf-v6-u-mt-sm"
                label="I don’t know"
                isChecked={levelUnknown}
                onChange={(_, v) => {
                  setLevelUnknown(v);
                  if (v) setRefereeLevel('');
                }}
              />
              <FormHelperText>
                <HelperText>
                  <HelperTextItem>
                    Self-reported grade for your profile — not the society
                    assessed level.
                  </HelperTextItem>
                </HelperText>
              </FormHelperText>
            </FormGroup>

            <FormGroup
              label="Society assessed level"
              fieldId="pf-assessed-level"
            >
              <p className="rs-match-card__meta">
                {currentUser.assessedLevel != null
                  ? `Your assessed level is ${currentUser.assessedLevel}.`
                  : 'Not assessed yet — your scheduler sets this after review.'}
              </p>
              {currentUser.requestedAssessedLevel != null ? (
                <div className="rs-stack">
                  <p className="rs-match-card__meta" role="status">
                    Pending request: level {currentUser.requestedAssessedLevel}
                  </p>
                  <Button
                    variant="link"
                    isDisabled={requestLevelBusy}
                    onClick={() => void withdrawLevelRequest()}
                  >
                    Withdraw request
                  </Button>
                </div>
              ) : (
                <div className="rs-form-row rs-form-row--2">
                  <TextInput
                    id="pf-assessed-level"
                    type="number"
                    min={ASSESSED_LEVEL_MIN}
                    max={ASSESSED_LEVEL_MAX}
                    value={requestLevelDraft}
                    placeholder="e.g. 5"
                    onChange={(_, v) => {
                      setRequestLevelDraft(v);
                      setRequestLevelNote(null);
                    }}
                  />
                  <Button
                    variant="secondary"
                    isDisabled={requestLevelBusy}
                    isLoading={requestLevelBusy}
                    onClick={() => void submitLevelRequest()}
                  >
                    Request assessed level
                  </Button>
                </div>
              )}
              {requestLevelNote && (
                <p className="rs-match-card__meta" role="status">
                  {requestLevelNote}
                </p>
              )}
            </FormGroup>
            <FormGroup label="Year started refereeing" isRequired>
              <TextInput
                type="number"
                inputMode="numeric"
                min={1950}
                max={new Date().getFullYear()}
                value={refereeingSince}
                onChange={(_, v) =>
                  setRefereeingSince(v.replace(/\D/g, '').slice(0, 4))
                }
                placeholder="e.g. 2018"
              />
            </FormGroup>
            <FormGroup label="Jersey size" isRequired>
              <div className="rs-onboard__sizes" role="group" aria-label="Jersey size">
                {APPAREL_SIZES.map((s) => (
                  <button
                    key={`j-${s}`}
                    type="button"
                    className={`rs-onboard__size${
                      jerseySize === s ? ' rs-onboard__size--selected' : ''
                    }`}
                    onClick={() => setJerseySize(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </FormGroup>
            <FormGroup label="Shorts size" isRequired>
              <div className="rs-onboard__sizes" role="group" aria-label="Shorts size">
                {APPAREL_SIZES.map((s) => (
                  <button
                    key={`sh-${s}`}
                    type="button"
                    className={`rs-onboard__size${
                      shortsSize === s ? ' rs-onboard__size--selected' : ''
                    }`}
                    onClick={() => setShortsSize(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </FormGroup>
          </>
        )}

        <Button
          variant="primary"
          isBlock
          isDisabled={!canSave}
          onClick={save}
        >
          {savedFlash ? 'Saved' : 'Save'}
        </Button>
        <Button
          variant="link"
          isBlock
          className="rs-sign-out"
          onClick={() => {
            signOut();
            navigate('/login');
          }}
        >
          Sign out
        </Button>
      </Form>
      )}
    </div>
  );
}
