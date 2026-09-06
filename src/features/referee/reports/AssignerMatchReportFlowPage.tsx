import { useMemo } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { Title } from '@patternfly/react-core';
import { useApp, useAppHref } from '@/app/AppContext';
import { officialHasCrewReportSlot, type CrewReportSlot } from '@/domain/reports';
import { crewPeople } from '@/domain/types';
import {
  MatchReportFlowPage,
  type AssignerFilingContext,
} from '@/features/referee/reports/MatchReportFlowPage';

function parseCrewReportSlot(raw: string | null): CrewReportSlot | null {
  if (raw === 'mo' || raw === 'ar1' || raw === 'ar2') return raw;
  return null;
}

export function AssignerMatchReportFlowPage() {
  const { matchId = '' } = useParams();
  const [params] = useSearchParams();
  const { hasAssignerRole, state } = useApp();
  const matchHref = useAppHref(`/matches/${matchId}`);

  const officialId = params.get('officialId') ?? '';
  const slot = parseCrewReportSlot(params.get('slot'));
  const match = state.matches.find((m) => m.id === matchId);

  const officialName = useMemo(() => {
    if (!officialId) return 'Official';
    const profile = state.users.find((u) => u.uid === officialId);
    if (profile?.displayName) return profile.displayName;
    if (match && slot) {
      const fromCrew = crewPeople(match.crew[slot]).find(
        (a) => a.userId === officialId,
      )?.userName;
      if (fromCrew) return fromCrew;
    }
    return 'Official';
  }, [match, officialId, slot, state.users]);

  if (!hasAssignerRole) {
    return <Navigate to={matchHref} replace />;
  }

  if (
    !match ||
    !officialId ||
    !slot ||
    !officialHasCrewReportSlot(match, officialId, slot)
  ) {
    return (
      <div className="rs-stack">
        <Title headingLevel="h2" size="lg">
          Cannot file this report
        </Title>
        <p className="rs-match-card__meta">
          Choose a crew member with a pending MO or AR report on this match.
        </p>
        <Link className="rs-detail__back" to={matchHref}>
          ← Back to match
        </Link>
      </div>
    );
  }

  const assignerFiling: AssignerFilingContext = {
    officialId,
    slot,
    officialName,
    back: { to: matchHref, label: 'Match' },
  };

  return <MatchReportFlowPage assignerFiling={assignerFiling} />;
}
