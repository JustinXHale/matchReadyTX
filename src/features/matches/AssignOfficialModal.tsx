import { useMemo } from 'react';
import {
  Button,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalVariant,
  Title,
} from '@patternfly/react-core';
import { useApp } from '@/app/AppContext';
import { orgTimeZone } from '@/domain/matchTime';
import { OfficialAssignPicker } from '@/features/matches/OfficialAssignPicker';
import {
  REQUESTABLE_SLOT_LABELS,
  hasRefereeLensRole,
  type CrewSlot,
  type Match,
  type RequestableSlot,
} from '@/domain/types';
import { persistCrewAssignmentAndEmail } from '@/services/liveAssignment';
import { defaultOrgId, saveMatchCrewAssignment } from '@/services/orgData';
import { isFirebaseConfigured } from '@/services/firebase';

export type CrewPickTarget = {
  slot: RequestableSlot;
  assignmentId?: string;
  cmoId?: string;
  cmoUserId?: string;
};

export function AssignOfficialModal({
  match,
  pickTarget,
  onClose,
}: {
  match: Match | null;
  pickTarget: CrewPickTarget | null;
  onClose: () => void;
}) {
  const { state, store, dataMode } = useApp();
  const orgTz = orgTimeZone(state.org.timezone);
  const officials = useMemo(
    () =>
      state.users
        .filter((u) => hasRefereeLensRole(u.roles))
        .sort((a, b) => a.displayName.localeCompare(b.displayName)),
    [state.users],
  );

  const liveMatch =
    (match && state.matches.find((m) => m.id === match.id)) || match;

  const onPick = (userId: string) => {
    if (!liveMatch || !pickTarget) return;
    const { slot } = pickTarget;
    if (slot === 'cmo') {
      store.assignCmo(liveMatch.id, userId, pickTarget.cmoId);
      if (dataMode === 'live' && isFirebaseConfigured) {
        const next = store.getState().matches.find((m) => m.id === liveMatch.id);
        if (next) {
          void saveMatchCrewAssignment(defaultOrgId(), next).catch((err) =>
            console.error('Failed to save CMO assignment', err),
          );
        }
      }
    } else {
      store.assignCrew(
        liveMatch.id,
        slot as CrewSlot,
        userId,
        false,
        pickTarget.assignmentId,
      );
      if (dataMode === 'live' && isFirebaseConfigured) {
        const next = store.getState().matches.find((m) => m.id === liveMatch.id);
        if (next) {
          void persistCrewAssignmentAndEmail({
            match: next,
            slot,
            userId,
          }).catch((err) => {
            console.error('Failed to save/email assignment', err);
            window.alert(
              err instanceof Error
                ? `Assigned locally, but email/save failed: ${err.message}`
                : 'Assigned locally, but email/save failed. Check the console.',
            );
          });
        }
      }
    }
    onClose();
  };

  return (
    <Modal
      variant={ModalVariant.small}
      isOpen={Boolean(liveMatch && pickTarget)}
      onClose={onClose}
      aria-labelledby="queue-pick-official-title"
    >
      <ModalHeader>
        <Title headingLevel="h2" id="queue-pick-official-title" size="lg">
          {pickTarget
            ? `Assign ${REQUESTABLE_SLOT_LABELS[pickTarget.slot]}`
            : 'Assign official'}
        </Title>
      </ModalHeader>
      <ModalBody>
        {liveMatch && pickTarget ? (
          <OfficialAssignPicker
            officials={officials}
            matches={state.matches}
            availability={state.availability}
            timeZone={orgTz}
            kickoffAt={liveMatch.kickoffAt}
            matchId={liveMatch.id}
            requests={state.requests}
            onPick={onPick}
          />
        ) : null}
      </ModalBody>
      <ModalFooter>
        <Button type="button" variant="link" onClick={onClose}>
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
}
