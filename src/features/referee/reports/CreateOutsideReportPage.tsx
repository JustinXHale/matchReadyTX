import { useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Button,
  Form,
  FormGroup,
  MenuContainer,
  MenuToggle,
  Panel,
  PanelMain,
  PanelMainBody,
  TextInput,
  Title,
} from '@patternfly/react-core';
import { useApp, useAppHref } from '@/app/AppContext';
import {
  hasRefereeLensRole,
  type UserProfile,
} from '@/domain/types';
import { memberListName } from '@/domain/members';
import {
  createOrJoinOutsideSessionDemo,
  createOrJoinOutsideSessionLive,
} from '@/services/reportsLive';
import { IconDateInput } from '@/ui/IconDateInput';
import { UserAvatar } from '@/ui/UserAvatar';
import {
  COACHING_REPORTS_BACK,
  outsideCmoPath,
  outsidePerformancePath,
} from '@/features/referee/reports/reportLinks';
import { useAppBack } from '@/nav/backNav';

type StarterRole = 'referee' | 'coach';

function roleFromQuery(raw: string | null): StarterRole {
  return raw === 'coach' ? 'coach' : 'referee';
}

export function CreateOutsideReportPage() {
  const { currentUser, state, dataMode } = useApp();
  const [searchParams] = useSearchParams();
  const starterRole = roleFromQuery(searchParams.get('as'));
  const navigate = useNavigate();
  const coachingHref = useAppHref('/referee/reports/coaching');
  const { goBack, backLabel } = useAppBack(COACHING_REPORTS_BACK);

  const [showAllRefs, setShowAllRefs] = useState(starterRole === 'coach');
  const [otherUid, setOtherUid] = useState('');
  const [matchDate, setMatchDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [homeTeamName, setHomeTeamName] = useState('');
  const [awayTeamName, setAwayTeamName] = useState('');
  const [division, setDivision] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const roster = useMemo(() => {
    if (!currentUser) return [];
    return state.users
      .filter((u) => u.uid !== currentUser.uid && u.profileComplete)
      .filter((u) => hasRefereeLensRole(u.roles))
      .filter((u) => (showAllRefs ? true : u.roles.includes('cmo')))
      .sort((a, b) =>
        memberListName(a).localeCompare(memberListName(b), undefined, {
          sensitivity: 'base',
        }),
      );
  }, [currentUser, state.users, showAllRefs]);

  const selectedOther = roster.find((u) => u.uid === otherUid);

  if (!currentUser) return null;

  const onSubmit = async () => {
    setError(null);
    if (!otherUid) {
      setError(
        starterRole === 'referee'
          ? 'Select the CMO or coach filing the coaching report.'
          : 'Select the referee you coached.',
      );
      return;
    }
    if (!matchDate) {
      setError('Match date is required.');
      return;
    }
    if (!homeTeamName.trim() || !awayTeamName.trim()) {
      setError('Enter both team names.');
      return;
    }

    const refereeId = starterRole === 'referee' ? currentUser.uid : otherUid;
    const coachId = starterRole === 'coach' ? currentUser.uid : otherUid;

    setSubmitting(true);
    try {
      const input = {
        starterUid: currentUser.uid,
        refereeId,
        coachId,
        matchDate,
        homeTeamName: homeTeamName.trim(),
        awayTeamName: awayTeamName.trim(),
        ...(division.trim() ? { division: division.trim() } : {}),
      };
      const session =
        dataMode === 'live'
          ? await createOrJoinOutsideSessionLive(input)
          : createOrJoinOutsideSessionDemo(input);

      navigate(
        starterRole === 'referee'
          ? outsidePerformancePath(session.id)
          : outsideCmoPath(session.id),
        { replace: true },
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not start outside report.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const personLabel =
    starterRole === 'referee' ? 'CMO / coach' : 'Referee';

  return (
    <div className="rs-stack">
      <button type="button" className="rs-detail__back" onClick={goBack}>
        ← {backLabel}
      </button>
      <Title headingLevel="h2" size="lg">
        Create outside report
      </Title>
      <p className="rs-match-card__meta">
        {starterRole === 'referee'
          ? 'Start your performance self-review for a club or society game. Pick who is writing your coaching report.'
          : 'Start a coaching report for a club or society game. Pick the referee you coached.'}
      </p>

      <Form
        onSubmit={(e) => {
          e.preventDefault();
          void onSubmit();
        }}
      >
        <FormGroup label={personLabel} isRequired fieldId="outside-other">
          <PersonSearchSelect
            id="outside-other"
            ariaLabel={personLabel}
            placeholder={
              starterRole === 'referee'
                ? showAllRefs
                  ? 'Search coach or referee'
                  : 'Search CMO'
                : 'Search referee'
            }
            options={roster}
            selectedUid={otherUid}
            onSelect={setOtherUid}
            rosterFilter={
              starterRole === 'referee'
                ? {
                    showAllRefs,
                    onShowAllRefsChange: (all) => {
                      setShowAllRefs(all);
                      setOtherUid('');
                    },
                  }
                : undefined
            }
          />
          {selectedOther && (
            <p className="rs-match-card__meta rs-outside-selected-person">
              Selected: {memberListName(selectedOther)}
              {selectedOther.roles.includes('cmo') ? ' · CMO' : ''}
            </p>
          )}
        </FormGroup>

        <FormGroup label="Match date" isRequired fieldId="outside-date">
          <IconDateInput
            id="outside-date"
            value={matchDate}
            onChange={(_e, v) => setMatchDate(v)}
            isRequired
          />
        </FormGroup>

        <div className="rs-outside-fixture-row">
          <FormGroup label="Home team" isRequired fieldId="outside-home">
            <TextInput
              id="outside-home"
              value={homeTeamName}
              onChange={(_e, v) => setHomeTeamName(v)}
              isRequired
            />
          </FormGroup>
          <FormGroup label="Away team" isRequired fieldId="outside-away">
            <TextInput
              id="outside-away"
              value={awayTeamName}
              onChange={(_e, v) => setAwayTeamName(v)}
              isRequired
            />
          </FormGroup>
          <FormGroup label="Level" fieldId="outside-div">
            <TextInput
              id="outside-div"
              value={division}
              onChange={(_e, v) => setDivision(v)}
              placeholder="e.g. D2"
            />
          </FormGroup>
        </div>

        {error && (
          <p className="rs-form-error-banner" role="alert">
            {error}
          </p>
        )}

        <div className="rs-report-actions">
          <Button
            variant="secondary"
            onClick={() => navigate(coachingHref)}
            isDisabled={submitting}
          >
            Cancel
          </Button>
          <Button type="submit" variant="primary" isDisabled={submitting}>
            {submitting ? 'Starting…' : 'Continue to report'}
          </Button>
        </div>
      </Form>
    </div>
  );
}

function PersonSearchSelect({
  id,
  ariaLabel,
  placeholder,
  options,
  selectedUid,
  onSelect,
  rosterFilter,
}: {
  id: string;
  ariaLabel: string;
  placeholder: string;
  options: UserProfile[];
  selectedUid: string;
  onSelect: (uid: string) => void;
  /** CMO vs all-referees toggle — shown inside the dropdown when starting as referee. */
  rosterFilter?: {
    showAllRefs: boolean;
    onShowAllRefsChange: (showAll: boolean) => void;
  };
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const toggleRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = options.find((u) => u.uid === selectedUid);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((u) => {
      const name = memberListName(u).toLowerCase();
      return name.includes(q) || u.email.toLowerCase().includes(q);
    });
  }, [options, query]);

  const toggleLabel = selected
    ? memberListName(selected)
    : placeholder;

  const menu = (
    <Panel ref={menuRef} variant="raised" className="rs-person-search__panel">
      <PanelMain>
        <PanelMainBody className="rs-person-search__body">
          {rosterFilter && (
            <div
              className="rs-slot-picker rs-person-search__filter"
              role="radiogroup"
              aria-label="Roster filter"
            >
              <button
                type="button"
                role="radio"
                aria-checked={!rosterFilter.showAllRefs}
                className={`rs-filter-chip${
                  !rosterFilter.showAllRefs ? ' rs-filter-chip--selected' : ''
                }`}
                onClick={() => rosterFilter.onShowAllRefsChange(false)}
              >
                CMOs
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={rosterFilter.showAllRefs}
                className={`rs-filter-chip${
                  rosterFilter.showAllRefs ? ' rs-filter-chip--selected' : ''
                }`}
                onClick={() => rosterFilter.onShowAllRefsChange(true)}
              >
                All referees
              </button>
            </div>
          )}
          <TextInput
            ref={searchRef}
            id={`${id}-search`}
            value={query}
            onChange={(_e, v) => setQuery(v)}
            placeholder="Type to search"
            aria-label={`Search ${ariaLabel}`}
            autoComplete="off"
          />
          <ul className="rs-person-search__list" role="listbox">
            {filtered.length === 0 ? (
              <li className="rs-match-card__meta">No matching officials.</li>
            ) : (
              filtered.map((u) => (
                <li key={u.uid} role="option" aria-selected={u.uid === selectedUid}>
                  <button
                    type="button"
                    className={`rs-person-search__option${
                      u.uid === selectedUid
                        ? ' rs-person-search__option--selected'
                        : ''
                    }`}
                    onClick={() => {
                      onSelect(u.uid);
                      setQuery('');
                      setIsOpen(false);
                    }}
                  >
                    <UserAvatar user={u} size="sm" />
                    <span className="rs-person-search__name">
                      {memberListName(u)}
                    </span>
                    {u.roles.includes('cmo') && (
                      <span className="rs-pill">CMO</span>
                    )}
                  </button>
                </li>
              ))
            )}
          </ul>
        </PanelMainBody>
      </PanelMain>
    </Panel>
  );

  return (
    <MenuContainer
      isOpen={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open);
        if (!open) setQuery('');
        if (open) {
          window.setTimeout(() => searchRef.current?.focus(), 0);
        }
      }}
      onOpenChangeKeys={['Escape']}
      menu={menu}
      menuRef={menuRef}
      toggle={
        <MenuToggle
          ref={toggleRef}
          id={id}
          onClick={() => setIsOpen((v) => !v)}
          isExpanded={isOpen}
          aria-label={ariaLabel}
          className="rs-person-search__toggle"
        >
          {selected ? (
            <span className="rs-person-search__toggle-value">
              <UserAvatar user={selected} size="sm" />
              <span>{toggleLabel}</span>
              {selected.roles.includes('cmo') && (
                <span className="rs-pill">CMO</span>
              )}
            </span>
          ) : (
            <span className="rs-person-search__toggle-placeholder">
              {toggleLabel}
            </span>
          )}
        </MenuToggle>
      }
      toggleRef={toggleRef}
    />
  );
}
