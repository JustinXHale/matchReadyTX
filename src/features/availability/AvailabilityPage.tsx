import { useCallback, useMemo, useState, type MouseEvent } from 'react';
import {
  Button,
  FormGroup,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalVariant,
  Radio,
  TextInput,
  Title,
} from '@patternfly/react-core';
import { useApp } from '@/app/AppContext';
import {
  applyWeekdayPattern,
  clearMonth,
  cycleDayState,
  dayAvailability,
  DEFAULT_AVAIL_END_HM,
  DEFAULT_AVAIL_START_HM,
  formatDayWindowsLabel,
  setDayState,
  setWeekdayInMonth,
  type TimeWindow,
} from '@/domain/availability';
import type { AvailabilityRange } from '@/domain/types';
import { isFirebaseConfigured } from '@/services/firebase';
import {
  defaultOrgId,
  syncUserAvailabilityRanges,
} from '@/services/availability';
import { IconDateInput } from '@/ui/IconDateInput';

const WEEKDAY_LABELS = [
  { d: 0, label: 'S', title: 'Sunday' },
  { d: 1, label: 'M', title: 'Monday' },
  { d: 2, label: 'T', title: 'Tuesday' },
  { d: 3, label: 'W', title: 'Wednesday' },
  { d: 4, label: 'T', title: 'Thursday' },
  { d: 5, label: 'F', title: 'Friday', busy: true },
  { d: 6, label: 'S', title: 'Saturday', busy: true },
] as const;

const DOW_HEADERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function monthTitle(year: number, month: number): string {
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function todayDayKey(timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const bag: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== 'literal') bag[p.type] = p.value;
  }
  return `${bag.year}-${bag.month}-${bag.day}`;
}

function buildMonthCells(year: number, month: number): (string | null)[] {
  const firstDow = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: (string | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(
      `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
    );
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function defaultWindow(): TimeWindow {
  return {
    startHm: DEFAULT_AVAIL_START_HM,
    endHm: DEFAULT_AVAIL_END_HM,
  };
}

/**
 * Referee/CMO availability — month calendar with tap cycle,
 * pattern apply, and bulk month actions. Persists to Firestore when live.
 */
export function AvailabilityPage() {
  const { currentUser, state, store, isRefereeView, setRoleView, refresh } =
    useApp();
  const timeZone = state.org.timezone || 'America/Chicago';

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const [patternOpen, setPatternOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [timeEditDay, setTimeEditDay] = useState<string | null>(null);
  const [editWindows, setEditWindows] = useState<TimeWindow[]>([
    defaultWindow(),
  ]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [patFrom, setPatFrom] = useState('');
  const [patTo, setPatTo] = useState('');
  const [patMode, setPatMode] = useState<'available' | 'blocked'>('available');
  const [patStart, setPatStart] = useState(DEFAULT_AVAIL_START_HM);
  const [patEnd, setPatEnd] = useState(DEFAULT_AVAIL_END_HM);
  const [patDays, setPatDays] = useState<number[]>([5, 6]);

  const todayKey = useMemo(() => todayDayKey(timeZone), [timeZone]);
  const togglePatDay = useCallback((d: number) => {
    setPatDays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort(),
    );
  }, []);

  const uid = currentUser?.uid ?? '';
  const mineAll = useMemo(
    () => state.availability.filter((r) => r.userId === uid),
    [state.availability, uid],
  );
  const cells = useMemo(() => buildMonthCells(year, month), [year, month]);

  if (!currentUser) return null;

  if (!isRefereeView) {
    return (
      <div className="rs-stack">
        <Title headingLevel="h2">Availability</Title>
        <p>
          Availability is managed in the Referee/CMO lens. Switch role in the
          header to continue.
        </p>
        <Button variant="secondary" onClick={() => setRoleView('referee')}>
          Switch to Referee/CMO
        </Button>
      </div>
    );
  }

  const persist = async (nextAll: AvailabilityRange[]) => {
    const nextMine = nextAll.filter((r) => r.userId === uid);
    store.replaceUserAvailability(uid, nextMine);
    refresh();
    if (isFirebaseConfigured && !uid.startsWith('u_')) {
      setBusy(true);
      setError(null);
      try {
        await syncUserAvailabilityRanges(defaultOrgId(), uid, nextMine);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Could not save availability.',
        );
      } finally {
        setBusy(false);
      }
    }
  };

  const nextId = () => store.nextAvailabilityId();

  const shiftMonth = (delta: number) => {
    let m = month + delta;
    let y = year;
    if (m < 1) {
      m = 12;
      y -= 1;
    } else if (m > 12) {
      m = 1;
      y += 1;
    }
    setYear(y);
    setMonth(m);
  };

  const onTapDay = (dayKey: string) => {
    void persist(
      cycleDayState(
        state.availability,
        uid,
        dayKey,
        timeZone,
        defaultWindow(),
        nextId,
      ),
    );
  };

  const openTimeEdit = (dayKey: string, e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const day = dayAvailability(state.availability, uid, dayKey, timeZone);
    if (day.state !== 'available') return;
    setEditWindows(
      day.windows.length > 0 ? day.windows.map((w) => ({ ...w })) : [defaultWindow()],
    );
    setTimeEditDay(dayKey);
  };

  const saveTimeEdit = () => {
    if (!timeEditDay) return;
    const windows = editWindows.filter(
      (w) => w.startHm && w.endHm && w.startHm < w.endHm,
    );
    if (windows.length === 0) {
      setError('Add at least one valid time window (from before to).');
      return;
    }
    void persist(
      setDayState(
        state.availability,
        uid,
        timeEditDay,
        timeZone,
        { state: 'available', windows },
        nextId,
      ),
    );
    setTimeEditDay(null);
  };

  const applyPattern = () => {
    if (!patFrom || !patTo || patDays.length === 0) return;
    void persist(
      applyWeekdayPattern(
        state.availability,
        uid,
        {
          fromDayKey: patFrom,
          toDayKey: patTo,
          weekdays: patDays,
          mode: patMode,
          startHm: patStart,
          endHm: patEnd,
          timeZone,
        },
        nextId,
      ),
    );
    setPatternOpen(false);
  };

  const runBulk = (
    action:
      | 'openFri'
      | 'openWeekend'
      | 'blockFri'
      | 'blockWeekend'
      | 'clear',
  ) => {
    let next = state.availability;
    if (action === 'clear') {
      next = clearMonth(next, uid, year, month, timeZone);
    } else if (action === 'openFri') {
      next = setWeekdayInMonth(
        next,
        uid,
        year,
        month,
        timeZone,
        [5],
        {
          state: 'available',
          startHm: DEFAULT_AVAIL_START_HM,
          endHm: DEFAULT_AVAIL_END_HM,
        },
        nextId,
      );
    } else if (action === 'openWeekend') {
      next = setWeekdayInMonth(
        next,
        uid,
        year,
        month,
        timeZone,
        [5, 6, 0],
        {
          state: 'available',
          startHm: DEFAULT_AVAIL_START_HM,
          endHm: DEFAULT_AVAIL_END_HM,
        },
        nextId,
      );
    } else if (action === 'blockFri') {
      next = setWeekdayInMonth(
        next,
        uid,
        year,
        month,
        timeZone,
        [5],
        { state: 'blocked' },
        nextId,
      );
    } else {
      next = setWeekdayInMonth(
        next,
        uid,
        year,
        month,
        timeZone,
        [5, 6, 0],
        { state: 'blocked' },
        nextId,
      );
    }
    void persist(next);
    setBulkOpen(false);
  };

  return (
    <div className="rs-stack rs-avail-page">
      <Title headingLevel="h2">Availability</Title>
      <p className="rs-match-card__meta">
        Days start closed. Tap to cycle: open (available) → blocked → closed.
        Use Edit on an open day to set one or more time windows.
      </p>

      <div className="rs-avail-legend" aria-label="Legend">
        <span className="rs-avail-legend__item">
          <span className="rs-avail-swatch rs-avail-swatch--available" />{' '}
          Available
        </span>
        <span className="rs-avail-legend__item">
          <span className="rs-avail-swatch rs-avail-swatch--blocked" /> Blocked
        </span>
        <span className="rs-avail-legend__item">
          <span className="rs-avail-swatch rs-avail-swatch--unmarked" /> Closed
        </span>
      </div>

      <div className="rs-avail-toolbar">
        <Button variant="secondary" onClick={() => setPatternOpen(true)}>
          Set pattern
        </Button>
        <Button variant="secondary" onClick={() => setBulkOpen(true)}>
          Bulk this month
        </Button>
      </div>

      <section
        className="rs-detail-card rs-avail-cal"
        aria-label="Month calendar"
      >
        <div className="rs-avail-cal__nav">
          <Button
            variant="plain"
            className="rs-avail-cal__nav-btn"
            aria-label="Previous month"
            onClick={() => shiftMonth(-1)}
          >
            ‹
          </Button>
          <h3 className="rs-avail-cal__title">{monthTitle(year, month)}</h3>
          <Button
            variant="plain"
            className="rs-avail-cal__nav-btn"
            aria-label="Next month"
            onClick={() => shiftMonth(1)}
          >
            ›
          </Button>
        </div>
        <div className="rs-avail-cal__dow" aria-hidden>
          {DOW_HEADERS.map((h, i) => (
            <span
              key={`${h}-${i}`}
              className={
                i === 5 || i === 6 ? 'rs-avail-cal__dow--busy' : undefined
              }
            >
              {h}
            </span>
          ))}
        </div>
        <div
          className="rs-avail-cal__grid"
          role="grid"
          aria-label={monthTitle(year, month)}
        >
          {cells.map((dayKey, idx) => {
            if (!dayKey) {
              return (
                <div
                  key={`e-${idx}`}
                  className="rs-avail-day rs-avail-day--empty"
                />
              );
            }
            const day = dayAvailability(mineAll, uid, dayKey, timeZone);
            const dom = Number(dayKey.slice(-2));
            const isToday = dayKey === todayKey;
            const windowLabel = formatDayWindowsLabel(day.windows);
            return (
              <div
                key={dayKey}
                role="gridcell"
                className={`rs-avail-day rs-avail-day--${day.state}${
                  isToday ? ' rs-avail-day--today' : ''
                }`}
              >
                <button
                  type="button"
                  className="rs-avail-day__hit"
                  aria-label={`${dayKey}, ${day.state}${
                    windowLabel ? `, ${windowLabel}` : ''
                  }`}
                  disabled={busy}
                  onClick={() => onTapDay(dayKey)}
                  onContextMenu={(e) => openTimeEdit(dayKey, e)}
                >
                  <span className="rs-avail-day__num">{dom}</span>
                  {day.state === 'available' && windowLabel && (
                    <span className="rs-avail-day__time">{windowLabel}</span>
                  )}
                </button>
                {day.state === 'available' && (
                  <button
                    type="button"
                    className="rs-avail-day__edit"
                    onClick={(e) => openTimeEdit(dayKey, e)}
                  >
                    Edit
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {error && (
        <p className="rs-match-card__meta" role="alert">
          {error}
        </p>
      )}
      {busy && (
        <p className="rs-match-card__meta" role="status">
          Saving…
        </p>
      )}

      <Modal
        variant={ModalVariant.small}
        isOpen={patternOpen}
        onClose={() => setPatternOpen(false)}
        aria-labelledby="avail-pattern-title"
      >
        <ModalHeader title="Set pattern" labelId="avail-pattern-title" />
        <ModalBody className="rs-form-stack">
          <p className="rs-modal-lede">
            Apply the same action to matching weekdays in a date range.
          </p>
          <FormGroup label="Action" fieldId="pat-mode">
            <Radio
              id="pat-mode-open"
              name="pat-mode"
              label="Open (available)"
              isChecked={patMode === 'available'}
              onChange={() => setPatMode('available')}
            />
            <Radio
              id="pat-mode-block"
              name="pat-mode"
              label="Block"
              isChecked={patMode === 'blocked'}
              onChange={() => setPatMode('blocked')}
            />
          </FormGroup>
          <FormGroup label="Start date" fieldId="pat-from">
            <IconDateInput
              id="pat-from"
              type="date"
              value={patFrom}
              onChange={(_, v) => setPatFrom(v)}
            />
          </FormGroup>
          <FormGroup label="End date" fieldId="pat-to">
            <IconDateInput
              id="pat-to"
              type="date"
              value={patTo}
              onChange={(_, v) => setPatTo(v)}
            />
          </FormGroup>
          <FormGroup label="Days of week">
            <div className="rs-avail-weekdays" role="group">
              {WEEKDAY_LABELS.map((w) => (
                <button
                  key={w.d}
                  type="button"
                  title={w.title}
                  className={`rs-avail-weekday${
                    patDays.includes(w.d) ? ' rs-avail-weekday--on' : ''
                  }${'busy' in w && w.busy ? ' rs-avail-weekday--busy' : ''}`}
                  onClick={() => togglePatDay(w.d)}
                >
                  {w.label}
                </button>
              ))}
            </div>
          </FormGroup>
          {patMode === 'available' && (
            <div className="rs-form-row rs-form-row--2">
              <FormGroup label="From" fieldId="pat-start">
                <TextInput
                  id="pat-start"
                  type="time"
                  value={patStart}
                  onChange={(_, v) => setPatStart(v)}
                />
              </FormGroup>
              <FormGroup label="To" fieldId="pat-end">
                <TextInput
                  id="pat-end"
                  type="time"
                  value={patEnd}
                  onChange={(_, v) => setPatEnd(v)}
                />
              </FormGroup>
            </div>
          )}
          {patMode === 'available' ? (
            <p className="rs-match-card__meta">
              Opening skips days you already blocked.
            </p>
          ) : (
            <p className="rs-match-card__meta">
              Blocking overwrites open or closed days in the range.
            </p>
          )}
        </ModalBody>
        <ModalFooter>
          <Button
            variant="primary"
            isDisabled={!patFrom || !patTo || patDays.length === 0 || busy}
            onClick={applyPattern}
          >
            Apply pattern
          </Button>
          <Button variant="link" onClick={() => setPatternOpen(false)}>
            Cancel
          </Button>
        </ModalFooter>
      </Modal>

      <Modal
        variant={ModalVariant.small}
        isOpen={bulkOpen}
        onClose={() => setBulkOpen(false)}
        aria-labelledby="avail-bulk-title"
      >
        <ModalHeader
          title={`Bulk · ${monthTitle(year, month)}`}
          labelId="avail-bulk-title"
        />
        <ModalBody className="rs-form-stack">
          <p className="rs-modal-lede">
            Quick actions for the month on screen. Opening skips blocked days.
          </p>
          <div className="rs-avail-modal-actions">
            <Button variant="secondary" onClick={() => runBulk('openFri')}>
              Open all Fridays
            </Button>
            <Button variant="secondary" onClick={() => runBulk('openWeekend')}>
              Open Fri–Sun
            </Button>
            <Button variant="secondary" onClick={() => runBulk('blockFri')}>
              Block all Fridays
            </Button>
            <Button variant="secondary" onClick={() => runBulk('blockWeekend')}>
              Block Fri–Sun
            </Button>
            <Button variant="danger" onClick={() => runBulk('clear')}>
              Clear this month
            </Button>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="link" onClick={() => setBulkOpen(false)}>
            Close
          </Button>
        </ModalFooter>
      </Modal>

      <Modal
        variant={ModalVariant.small}
        isOpen={timeEditDay != null}
        onClose={() => setTimeEditDay(null)}
        aria-labelledby="avail-time-title"
      >
        <ModalHeader title="Edit hours" labelId="avail-time-title" />
        <ModalBody className="rs-form-stack">
          <p className="rs-modal-lede">
            {timeEditDay} — add one or more windows (e.g. 7–10 and 11–4).
          </p>
          <div className="rs-avail-windows">
            {editWindows.map((w, i) => (
              <div key={i} className="rs-avail-windows__row">
                <div className="rs-form-row rs-form-row--2">
                  <FormGroup label="From" fieldId={`edit-start-${i}`}>
                    <TextInput
                      id={`edit-start-${i}`}
                      type="time"
                      value={w.startHm}
                      onChange={(_, v) =>
                        setEditWindows((prev) =>
                          prev.map((row, idx) =>
                            idx === i ? { ...row, startHm: v } : row,
                          ),
                        )
                      }
                    />
                  </FormGroup>
                  <FormGroup label="To" fieldId={`edit-end-${i}`}>
                    <TextInput
                      id={`edit-end-${i}`}
                      type="time"
                      value={w.endHm}
                      onChange={(_, v) =>
                        setEditWindows((prev) =>
                          prev.map((row, idx) =>
                            idx === i ? { ...row, endHm: v } : row,
                          ),
                        )
                      }
                    />
                  </FormGroup>
                </div>
                {editWindows.length > 1 && (
                  <Button
                    variant="link"
                    isInline
                    onClick={() =>
                      setEditWindows((prev) =>
                        prev.filter((_, idx) => idx !== i),
                      )
                    }
                  >
                    Remove
                  </Button>
                )}
              </div>
            ))}
          </div>
          <Button
            variant="secondary"
            className="pf-v6-u-mt-sm"
            onClick={() =>
              setEditWindows((prev) => [...prev, defaultWindow()])
            }
          >
            Add window
          </Button>
        </ModalBody>
        <ModalFooter>
          <Button variant="primary" onClick={saveTimeEdit}>
            Save hours
          </Button>
          <Button variant="link" onClick={() => setTimeEditDay(null)}>
            Cancel
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
