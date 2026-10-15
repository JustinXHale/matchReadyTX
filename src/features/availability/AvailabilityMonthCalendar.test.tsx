import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  availableDayRange,
  blockedDayRange,
} from '@/domain/availability';
import { AvailabilityMonthCalendar } from './AvailabilityMonthCalendar';

const timeZone = 'America/Chicago';
const userId = 'u1';

describe('AvailabilityMonthCalendar', () => {
  it('communicates every state without relying on color', () => {
    const onDayTap = vi.fn();
    render(
      <AvailabilityMonthCalendar
        ranges={[
          availableDayRange(
            userId,
            '2026-10-14',
            timeZone,
            { startHm: '07:00', endHm: '21:00' },
            'available-14',
          ),
          blockedDayRange(
            userId,
            '2026-10-15',
            timeZone,
            'blocked-15',
          ),
        ]}
        userId={userId}
        timeZone={timeZone}
        year={2026}
        month={10}
        onMonthChange={vi.fn()}
        onDayTap={onDayTap}
      />,
    );

    const available = screen.getByRole('button', {
      name: '2026-10-14, Available, 7a–9p. Tap to mark blocked',
    });
    const blocked = screen.getByRole('button', {
      name: '2026-10-15, Blocked. Tap to mark closed',
    });
    const closed = screen.getByRole('button', {
      name: '2026-10-16, Closed. Tap to mark available',
    });

    expect(within(available).getByText('Available')).toBeTruthy();
    expect(within(blocked).getByText('Blocked')).toBeTruthy();
    expect(within(closed).getByText('Closed')).toBeTruthy();
    expect(blocked.closest('.rs-avail-day')?.className).toContain(
      'rs-avail-day--blocked',
    );

    fireEvent.click(available);
    expect(onDayTap).toHaveBeenCalledWith('2026-10-14');
  });
});
