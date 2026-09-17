import { describe, expect, it } from 'vitest';
import {
  distanceBetweenAirports,
  getTotalFlightMiles,
  normalizeAirportCode,
} from './matchCalendarFlightDistance';

describe('matchCalendarFlightDistance', () => {
  it('normalizes airport codes', () => {
    expect(normalizeAirportCode(' den ')).toBe('DEN');
    expect(normalizeAirportCode('DEN - Houston')).toBe('DEN');
    expect(normalizeAirportCode('San Diego International')).toBeNull();
  });

  it('computes known airport distances', () => {
    const miles = distanceBetweenAirports('SAN', 'LAX');
    expect(miles).toBeGreaterThanOrEqual(95);
    expect(miles).toBeLessThanOrEqual(120);
  });

  it('sums multi-segment flight mileage', () => {
    const total = getTotalFlightMiles({
      segments: [
        { departureAirport: 'MCO', arrivalAirport: 'TPA' },
        { departureAirport: 'TPA', arrivalAirport: 'MCO' },
      ],
    });

    expect(total).toBeGreaterThan(150);
    expect(total).toBeLessThan(220);
  });
});
