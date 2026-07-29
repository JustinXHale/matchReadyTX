import { useRef, useState } from 'react';
import {
  Button,
  Checkbox,
  Form,
  FormGroup,
  FormHelperText,
  HelperText,
  HelperTextItem,
  TextInput,
  Title,
} from '@patternfly/react-core';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/app/AppContext';
import {
  hasCompleteHomeAddress,
  readFileAsDataUrl,
  validateProfilePhoto,
} from '@/domain/profile';
import { APPAREL_SIZES, type Role } from '@/domain/types';
import { isFirebaseConfigured } from '@/services/firebase';
import { saveFirebaseProfile } from '@/services/userProfile';
import { RefereeLevelChart } from '@/ui/RefereeLevelChart';
import { UserAvatar } from '@/ui/UserAvatar';

export function ProfilePage() {
  const { currentUser, store, signOut } = useApp();
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

  if (!currentUser) return null;

  const needsRefDetails = roleOfficial || roleCmo;
  const levelNum = Number(refereeLevel);
  const rolesOk = roleOfficial || roleTeamAdmin || roleCmo;
  const levelOk =
    levelUnknown ||
    (Number.isFinite(levelNum) && levelNum >= 1 && levelNum <= 20);
  const canSave =
    Boolean(firstName.trim()) &&
    Boolean(lastName.trim()) &&
    Boolean(email.trim()) &&
    Boolean(phone.trim()) &&
    rolesOk &&
    Boolean(birthday.trim()) &&
    (!needsRefDetails ||
      (hasCompleteHomeAddress({
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
        Boolean(shortsSize)));

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
    if (currentUser.roles.includes('assigner')) roles.push('assigner');

    const patch: Parameters<typeof store.updateProfile>[1] = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      // SMS deferred — keep false until we ship SMS again.
      smsOptIn: false,
      roles,
      birthday: birthday.trim(),
      photoUrl,
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

  const previewUser = {
    firstName,
    lastName,
    displayName: `${firstName} ${lastName}`.trim() || currentUser.displayName,
    photoUrl,
  };

  return (
    <div className="rs-stack">
      <Title headingLevel="h2">Profile</Title>
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
          <FormGroup label="Phone" isRequired>
            <TextInput
              type="tel"
              value={phone}
              onChange={(_, v) => setPhone(v)}
              autoComplete="tel"
            />
          </FormGroup>
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
              onChange={(_, v) => setRoleOfficial(v)}
            />
            <Checkbox
              id="pf-role-team"
              label="Team Admin"
              isChecked={roleTeamAdmin}
              onChange={(_, v) => setRoleTeamAdmin(v)}
            />
            <Checkbox
              id="pf-role-cmo"
              label="CMO"
              isChecked={roleCmo}
              onChange={(_, v) => setRoleCmo(v)}
            />
          </div>
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
        </FormGroup>

        <FormGroup label="Birthday" isRequired>
          <TextInput
            type="date"
            value={birthday}
            onChange={(_, v) => setBirthday(v)}
          />
        </FormGroup>

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
    </div>
  );
}
