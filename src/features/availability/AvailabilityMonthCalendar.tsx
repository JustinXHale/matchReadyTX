import { useMemo, type MouseEvent } from 'react';
import './availability.css';
import { Button } from '@patternfly/react-core';
import {
  dayAvailability,
  formatDayWindowsLabel,
} from '@/domain/availability';
import type { AvailabilityRange } from '@/domain/types';
import {
  AVAIL_DOW_HEADERS,
  buildMonthCells,
  monthTitle,
  shiftMonth,
  todayDayKey,
} from '@/features/availability/availabilityCalendar';

type Props = {
  ranges: AvailabilityRange[];
  userId: string;
  timeZone: string;
  year: number;
  month: number;
  onMonthChange: (year: number, month: number) => void;
  readOnly?: boolean;
  busy?: boolean;
  onDayTap?: (dayKey: string) => void;
  onDayTimeEdit?: (dayKey: string, e: MouseEvent) => void;
  showLegend?: boolean;
  className?: string;
};

/**
 * Month availability grid — interactive on AvailabilityPage, read-only on member profile.
 */
export function AvailabilityMonthCalendar({
  ranges,
  userId,
  timeZone,
  year,
  month,
  onMonthChange,
  readOnly = false,
  busy = false,
  onDayTap,
  onDayTimeEdit,
  showLegend = true,
  className,
}: Props) {
  const todayKey = useMemo(() => todayDayKey(timeZone), [timeZone]);
  const cells = useMemo(() => buildMonthCells(year, month), [year, month]);

  const sectionClass = ['rs-detail-card rs-avail-cal', className]
    .filter(Boolean)
    .join(' ');

  return (
    <>
      {showLegend && (
        <div className="rs-avail-legend" aria-label="Legend">
          <span className="rs-avail-legend__item">
            <span className="rs-avail-swatch rs-avail-swatch--available" />{' '}
            Available
          </span>
          <span className="rs-avail-legend__item">
            <span className="rs-avail-swatch rs-avail-swatch--blocked" />{' '}
            Blocked
          </span>
          <span className="rs-avail-legend__item">
            <span className="rs-avail-swatch rs-avail-swatch--unmarked" /> Closed
          </span>
        </div>
      )}

      <section className={sectionClass} aria-label="Month calendar">
        <div className="rs-avail-cal__nav">
          <Button
            variant="plain"
            className="rs-avail-cal__nav-btn"
            aria-label="Previous month"
            onClick={() => {
              const next = shiftMonth(year, month, -1);
              onMonthChange(next.year, next.month);
            }}
          >
            ‹
          </Button>
          <h3 className="rs-avail-cal__title">{monthTitle(year, month)}</h3>
          <Button
            variant="plain"
            className="rs-avail-cal__nav-btn"
            aria-label="Next month"
            onClick={() => {
              const next = shiftMonth(year, month, 1);
              onMonthChange(next.year, next.month);
            }}
          >
            ›
          </Button>
        </div>
        <div className="rs-avail-cal__dow" aria-hidden>
          {AVAIL_DOW_HEADERS.map((h, i) => (
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
            const day = dayAvailability(ranges, userId, dayKey, timeZone);
            const dom = Number(dayKey.slice(-2));
            const isToday = dayKey === todayKey;
            const windowLabel = formatDayWindowsLabel(day.windows);
            const interactive = !readOnly && onDayTap;

            return (
              <div
                key={dayKey}
                role="gridcell"
                className={`rs-avail-day rs-avail-day--${day.state}${
                  isToday ? ' rs-avail-day--today' : ''
                }`}
              >
                {interactive ? (
                  <button
                    type="button"
                    className="rs-avail-day__hit"
                    aria-label={`${dayKey}, ${day.state}${
                      windowLabel ? `, ${windowLabel}` : ''
                    }`}
                    disabled={busy}
                    onClick={() => onDayTap(dayKey)}
                    onContextMenu={(e) => onDayTimeEdit?.(dayKey, e)}
                  >
                    <span className="rs-avail-day__num">{dom}</span>
                    {day.state === 'available' && windowLabel && (
                      <span className="rs-avail-day__time">{windowLabel}</span>
                    )}
                  </button>
                ) : (
                  <div
                    className="rs-avail-day__hit rs-avail-day__hit--static"
                    aria-label={`${dayKey}, ${day.state}${
                      windowLabel ? `, ${windowLabel}` : ''
                    }`}
                  >
                    <span className="rs-avail-day__num">{dom}</span>
                    {day.state === 'available' && windowLabel && (
                      <span className="rs-avail-day__time">{windowLabel}</span>
                    )}
                  </div>
                )}
                {!readOnly && day.state === 'available' && onDayTimeEdit && (
                  <button
                    type="button"
                    className="rs-avail-day__edit"
                    onClick={(e) => onDayTimeEdit(dayKey, e)}
                  >
                    Edit
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
