import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Button,
  FormGroup,
  FormSelect,
  FormSelectOption,
  TextArea,
  TextInput,
  Title,
} from '@patternfly/react-core';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp, useAppHref } from '@/app/AppContext';
import {
  COACH_FEEDBACK_CRITERION_LABELS,
  COACH_FEEDBACK_SCALE_KEYS,
  COACH_FEEDBACK_SCALE_LABELS,
  COACH_FEEDBACK_SCALE_LEGEND,
  COACH_FEEDBACK_SCALE_VALUES,
  coachFeedbackDocId,
  existingCoachFeedback,
  formatMatchScore,
  isMatchEligibleForCoachFeedback,
  matchOfficialForFeedback,
  reportingTeamIdForUser,
  scalesNeedComments,
  validateCoachFeedbackScales,
  type CoachFeedback,
  type CoachFeedbackScaleKey,
  type CoachFeedbackScaleValue,
} from '@/domain/coachFeedback';
import { isFirebaseConfigured } from '@/services/firebase';
import {
  defaultOrgId,
  saveCoachFeedbackInFirestore,
} from '@/services/orgData';

function hydrateFromExisting(
  existing: CoachFeedback | undefined,
  matchScore: string,
  userPhone: string,
): {
  score: string;
  scales: Partial<Record<CoachFeedbackScaleKey, CoachFeedbackScaleValue>>;
  commentsOnScores: string;
  areasDoneWell: string;
  areasToImprove: string;
  otherFeedback: string;
  otherCrewFeedback: string;
  videoLink: string;
  videoNotes: string;
  clubRole: string;
  phone: string;
} {
  return {
    score: existing?.score ?? matchScore,
    scales: existing?.scales ?? {},
    commentsOnScores: existing?.commentsOnScores ?? '',
    areasDoneWell: existing?.areasDoneWell ?? '',
    areasToImprove: existing?.areasToImprove ?? '',
    otherFeedback: existing?.otherFeedback ?? '',
    otherCrewFeedback: existing?.otherCrewFeedback ?? '',
    videoLink: existing?.videoLink ?? '',
    videoNotes: existing?.videoNotes ?? '',
    clubRole: existing?.clubRole ?? '',
    phone: existing?.submitterPhone ?? userPhone,
  };
}

export function CoachFeedbackFormPage() {
  const { matchId = '' } = useParams();
  const { currentUser, state, store, dataMode, refresh } = useApp();
  const navigate = useNavigate();
  const reportListHref = useAppHref('/team-admin/report');

  const match = state.matches.find((m) => m.id === matchId);

  const context = useMemo(() => {
    if (!currentUser || !match) return null;
    if (!isMatchEligibleForCoachFeedback(match, currentUser)) return null;
    const reportingTeamId = reportingTeamIdForUser(match, currentUser);
    if (!reportingTeamId) return null;
    const mo = matchOfficialForFeedback(match);
    if (!mo) return null;
    const reportingTeamName =
      reportingTeamId === match.homeTeamId
        ? match.homeTeamName
        : match.awayTeamName;
    const existing = existingCoachFeedback(
      state.coachFeedback,
      match.id,
      reportingTeamId,
    );
    return { reportingTeamId, reportingTeamName, mo, existing };
  }, [currentUser, match, state.coachFeedback]);

  const existing = context?.existing;
  const matchScore = match ? formatMatchScore(match) : '';
  const userPhone = currentUser?.phone ?? '';

  const initial = hydrateFromExisting(existing, matchScore, userPhone);
  const [score, setScore] = useState(initial.score);
  const [scales, setScales] = useState(initial.scales);
  const [commentsOnScores, setCommentsOnScores] = useState(
    initial.commentsOnScores,
  );
  const [areasDoneWell, setAreasDoneWell] = useState(initial.areasDoneWell);
  const [areasToImprove, setAreasToImprove] = useState(initial.areasToImprove);
  const [otherFeedback, setOtherFeedback] = useState(initial.otherFeedback);
  const [otherCrewFeedback, setOtherCrewFeedback] = useState(
    initial.otherCrewFeedback,
  );
  const [videoLink, setVideoLink] = useState(initial.videoLink);
  const [videoNotes, setVideoNotes] = useState(initial.videoNotes);
  const [clubRole, setClubRole] = useState(initial.clubRole);
  const [phone, setPhone] = useState(initial.phone);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const hydratedKey = useRef<string | null>(null);

  // Rehydrate when club feedback arrives from live snapshot (or switches docs).
  useEffect(() => {
    const key = existing
      ? `${existing.id}:${existing.updatedAt}`
      : match
        ? `new:${match.id}`
        : null;
    if (!key || hydratedKey.current === key) return;
    // Don't clobber in-progress edits after the first hydrate for this key.
    if (
      hydratedKey.current != null &&
      hydratedKey.current.startsWith(`new:`) &&
      key.startsWith(`new:`)
    ) {
      return;
    }
    const next = hydrateFromExisting(existing, matchScore, userPhone);
    setScore(next.score);
    setScales(next.scales);
    setCommentsOnScores(next.commentsOnScores);
    setAreasDoneWell(next.areasDoneWell);
    setAreasToImprove(next.areasToImprove);
    setOtherFeedback(next.otherFeedback);
    setOtherCrewFeedback(next.otherCrewFeedback);
    setVideoLink(next.videoLink);
    setVideoNotes(next.videoNotes);
    setClubRole(next.clubRole);
    setPhone(next.phone);
    hydratedKey.current = key;
  }, [existing, match, matchScore, userPhone]);

  if (!currentUser) return null;

  if (!match || !context) {
    return (
      <div className="rs-stack">
        <Button
          variant="link"
          className="rs-detail__back"
          onClick={() => navigate(reportListHref)}
        >
          ← Report
        </Button>
        <Title headingLevel="h2" size="lg">
          Feedback not available
        </Title>
        <p className="rs-match-card__meta">
          This match is not eligible for referee feedback, or you are not a
          Team Admin for either side.
        </p>
      </div>
    );
  }

  const { reportingTeamId, reportingTeamName, mo } = context;
  const when = new Date(match.kickoffAt).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  const onSubmit = async () => {
    setError(null);
    if (!validateCoachFeedbackScales(scales)) {
      setError('Rate every criterion.');
      return;
    }
    if (scalesNeedComments(scales) && !commentsOnScores.trim()) {
      setError('Add comments when any score is Below Average or Poor.');
      return;
    }
    if (!clubRole.trim()) {
      setError('Enter your role within the club.');
      return;
    }

    const now = new Date().toISOString();
    const feedback: CoachFeedback = {
      id: coachFeedbackDocId(match.id, reportingTeamId),
      orgId: dataMode === 'live' ? defaultOrgId() : state.org.id,
      matchId: match.id,
      slot: 'mo',
      officialUserId: mo.userId,
      officialName: mo.userName,
      homeTeamId: match.homeTeamId,
      homeTeamName: match.homeTeamName,
      awayTeamId: match.awayTeamId,
      awayTeamName: match.awayTeamName,
      kickoffAt: match.kickoffAt,
      competition: match.competition,
      level: match.level,
      score: score.trim(),
      scales,
      commentsOnScores: commentsOnScores.trim() || undefined,
      areasDoneWell: areasDoneWell.trim() || undefined,
      areasToImprove: areasToImprove.trim() || undefined,
      otherFeedback: otherFeedback.trim() || undefined,
      videoLink: videoLink.trim() || undefined,
      videoNotes: videoNotes.trim() || undefined,
      otherCrewFeedback: otherCrewFeedback.trim() || undefined,
      submitterUserId: currentUser.uid,
      submitterName: currentUser.displayName,
      submitterEmail: currentUser.email,
      submitterPhone: phone.trim() || undefined,
      clubRole: clubRole.trim(),
      reportingTeamId,
      reportingTeamName,
      status: 'submitted',
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    setBusy(true);
    try {
      if (dataMode === 'live' && isFirebaseConfigured) {
        await saveCoachFeedbackInFirestore(defaultOrgId(), feedback);
        store.upsertCoachFeedbackLocal(feedback);
      } else {
        const id = store.saveCoachFeedback(feedback);
        if (!id) {
          setError('Could not save feedback. Check your club access.');
          return;
        }
      }
      refresh();
      navigate(reportListHref);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not save feedback.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rs-stack">
      <Button
        variant="link"
        className="rs-detail__back"
        onClick={() => navigate(reportListHref)}
      >
        ← Report
      </Button>
      <Title headingLevel="h1" size="lg">
        {existing ? 'Edit referee feedback' : 'Referee feedback'}
      </Title>
      <p className="rs-match-card__meta">
        {match.homeTeamName} vs {match.awayTeamName} · {when}
        <br />
        Match Official: {mo.userName} · Reporting as {reportingTeamName}
      </p>
      <p className="rs-match-card__meta">{COACH_FEEDBACK_SCALE_LEGEND}</p>
      <p className="rs-match-card__meta">
        For Below Average or Poor, add specifics in the comments.
      </p>

      <div className="rs-form-stack">
        <FormGroup label="Score" fieldId="cf-score">
          <TextInput
            id="cf-score"
            value={score}
            onChange={(_e, v) => setScore(v)}
            placeholder="e.g. 28–17"
          />
        </FormGroup>

        {COACH_FEEDBACK_SCALE_KEYS.map((key) => (
          <FormGroup
            key={key}
            label={COACH_FEEDBACK_CRITERION_LABELS[key]}
            isRequired
            fieldId={`cf-scale-${key}`}
          >
            <FormSelect
              id={`cf-scale-${key}`}
              value={scales[key] ?? ''}
              onChange={(_e, v) =>
                setScales((prev) => ({
                  ...prev,
                  [key]: v as CoachFeedbackScaleValue,
                }))
              }
              aria-label={COACH_FEEDBACK_CRITERION_LABELS[key]}
            >
              <FormSelectOption value="" label="Select…" isDisabled />
              {COACH_FEEDBACK_SCALE_VALUES.map((v) => (
                <FormSelectOption
                  key={v}
                  value={v}
                  label={COACH_FEEDBACK_SCALE_LABELS[v]}
                />
              ))}
            </FormSelect>
          </FormGroup>
        ))}

        <FormGroup
          label="Comments related to scores"
          fieldId="cf-comments"
          isRequired={scalesNeedComments(scales)}
        >
          <TextArea
            id="cf-comments"
            value={commentsOnScores}
            onChange={(_e, v) => setCommentsOnScores(v)}
            rows={3}
          />
        </FormGroup>

        <FormGroup label="Areas of the game refereed well" fieldId="cf-well">
          <TextArea
            id="cf-well"
            value={areasDoneWell}
            onChange={(_e, v) => setAreasDoneWell(v)}
            rows={3}
          />
        </FormGroup>

        <FormGroup label="Areas for improvement" fieldId="cf-improve">
          <TextArea
            id="cf-improve"
            value={areasToImprove}
            onChange={(_e, v) => setAreasToImprove(v)}
            rows={3}
          />
        </FormGroup>

        <FormGroup label="Other relevant feedback" fieldId="cf-other">
          <TextArea
            id="cf-other"
            value={otherFeedback}
            onChange={(_e, v) => setOtherFeedback(v)}
            rows={2}
          />
        </FormGroup>

        <FormGroup
          label="Feedback on other crew (optional)"
          fieldId="cf-crew"
        >
          <TextArea
            id="cf-crew"
            value={otherCrewFeedback}
            onChange={(_e, v) => setOtherCrewFeedback(v)}
            rows={2}
            placeholder="AR, No.4, or other crew notes"
          />
        </FormGroup>

        <FormGroup label="Video link" fieldId="cf-video">
          <TextInput
            id="cf-video"
            value={videoLink}
            onChange={(_e, v) => setVideoLink(v)}
            placeholder="https://…"
          />
        </FormGroup>

        <FormGroup label="Video notes" fieldId="cf-video-notes">
          <TextArea
            id="cf-video-notes"
            value={videoNotes}
            onChange={(_e, v) => setVideoNotes(v)}
            rows={2}
            placeholder="Timestamps for issues in the video"
          />
        </FormGroup>

        <Title headingLevel="h2" size="md">
          Contact details
        </Title>

        <FormGroup label="Your name" fieldId="cf-name">
          <TextInput
            id="cf-name"
            value={currentUser.displayName}
            isDisabled
          />
        </FormGroup>

        <FormGroup label="Email" fieldId="cf-email">
          <TextInput id="cf-email" value={currentUser.email} isDisabled />
        </FormGroup>

        <FormGroup label="Phone" fieldId="cf-phone">
          <TextInput
            id="cf-phone"
            value={phone}
            onChange={(_e, v) => setPhone(v)}
          />
        </FormGroup>

        <FormGroup
          label="Role within your club"
          fieldId="cf-role"
          isRequired
        >
          <TextInput
            id="cf-role"
            value={clubRole}
            onChange={(_e, v) => setClubRole(v)}
            placeholder="Head Coach, Captain, President…"
          />
        </FormGroup>

        {error && (
          <Alert variant="danger" title={error} isInline />
        )}

        <div className="rs-actions">
          <Button
            variant="primary"
            onClick={() => void onSubmit()}
            isDisabled={busy}
            isLoading={busy}
          >
            {existing ? 'Update feedback' : 'Submit feedback'}
          </Button>
          <Button
            variant="link"
            onClick={() => navigate(reportListHref)}
            isDisabled={busy}
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
