import { describe, expect, it } from 'vitest';
import {
  getInsightsSummary,
  mergeInsightsSummaries,
} from './matchCalendarInsightsCore';

describe('matchCalendarInsightsCore', () => {
  it('merges insight summaries across events', () => {
    const summaryA = getInsightsSummary(
      [
        {
          id: 'a',
          status: 'upcoming',
          matchType: 'xvs',
          positionPreset: 'referee',
          payStatus: 'paid',
          paidAmount: 100,
          competition: 'NCR',
          expenses: [
            {
              category: 'parking',
              amount: 20,
              reimbursementStatus: 'not_expected',
            },
            { category: 'miles_driven', amount: 0, miles: 50 },
          ],
        },
      ],
      [],
    );

    const summaryB = getInsightsSummary(
      [
        {
          id: 'b',
          status: 'upcoming',
          matchType: '7s',
          positionPreset: 'assistant_referee',
          payStatus: 'paid',
          paidAmount: 75,
          competition: 'NCR',
          expenses: [
            {
              category: 'food',
              amount: 15,
              reimbursementStatus: 'not_expected',
            },
            { category: 'miles_flown', amount: 0, miles: 200 },
          ],
        },
      ],
      [],
    );

    const merged = mergeInsightsSummaries([summaryA, summaryB]);
    expect(merged.eventCount).toBe(2);
    expect(merged.milesDriven).toBe(50);
    expect(merged.drivenTrips).toBe(1);
    expect(merged.milesFlown).toBe(200);
    expect(merged.flightSegments).toBe(0);
    expect(merged.paid).toBe(175);
    expect(merged.expenses).toBe(35);
    expect(merged.net).toBe(140);
    expect(merged.organizations).toHaveLength(1);
    expect(merged.organizations[0].organization).toBe('NCR');
  });

  it('includes derived flight miles and segment counts', () => {
    const summary = getInsightsSummary(
      [
        {
          id: 'flight',
          status: 'completed',
          matchType: 'xvs',
          positionPreset: 'referee',
          payStatus: 'paid',
          paidAmount: 100,
          flight: {
            segments: [
              {
                airline: 'Demo Air',
                departureAirport: 'DEN',
                arrivalAirport: 'IAH',
              },
              {
                airline: 'Demo Air',
                departureAirport: 'IAH',
                arrivalAirport: 'DEN',
              },
            ],
          },
        },
      ],
      [],
    );

    expect(summary.flightSegments).toBe(2);
    expect(summary.milesFlown).toBeGreaterThan(1500);
  });

  it('sums flight minutes from segment times', () => {
    const summary = getInsightsSummary(
      [
        {
          id: 'timed-flight',
          status: 'completed',
          matchType: 'xvs',
          positionPreset: 'referee',
          flight: {
            segments: [
              {
                departureAt: '2026-09-05T09:00:00.000Z',
                arrivalAt: '2026-09-05T11:30:00.000Z',
              },
            ],
          },
        },
      ],
      [],
    );

    expect(summary.flightMinutes).toBe(150);
  });
});
