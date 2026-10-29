import { describe, expect, it } from 'vitest';
import {
  changesFromProposal,
  changesFromScheduleUpdate,
  extractCrewUserIds,
  extractCmoUserIds,
} from './notifyMatchChange';

describe('changesFromProposal', () => {
  it('reads previousKickoffAt from proposal docs, not oldKickoffAt', () => {
    const detected = changesFromProposal({
      kickoffAt: '2026-10-26T18:00:00.000Z',
      previousKickoffAt: '2026-10-26T16:00:00.000Z',
      venueName: 'Field A',
      previousVenueName: 'Field A',
    });
    expect(detected?.changeType).toBe('time');
    expect(detected?.changes.oldKickoffAt).toBe('2026-10-26T16:00:00.000Z');
    expect(detected?.changes.newKickoffAt).toBe('2026-10-26T18:00:00.000Z');
  });

  it('returns details when time and venue both change', () => {
    const detected = changesFromProposal({
      kickoffAt: '2026-10-26T18:00:00.000Z',
      previousKickoffAt: '2026-10-26T16:00:00.000Z',
      venueName: 'New Field',
      previousVenueName: 'Old Field',
    });
    expect(detected?.changeType).toBe('details');
    expect(detected?.changes.newVenueName).toBe('New Field');
  });

  it('returns null when previous snapshot fields are missing', () => {
    expect(
      changesFromProposal({
        kickoffAt: '2026-10-26T18:00:00.000Z',
        oldKickoffAt: '2026-10-26T16:00:00.000Z',
      }),
    ).toBeNull();
  });
});

describe('changesFromScheduleUpdate', () => {
  it('detects address-only venue changes', () => {
    const detected = changesFromScheduleUpdate({
      previousKickoffAt: '2026-10-26T16:00:00.000Z',
      kickoffAt: '2026-10-26T16:00:00.000Z',
      previousVenueName: 'Field A',
      venueName: 'Field A',
      previousVenueAddress: '',
      venueAddress: '123 Main St',
    });
    expect(detected?.changeType).toBe('venue');
    expect(detected?.changes.newVenueAddress).toBe('123 Main St');
  });

  it('returns null when facts are unchanged', () => {
    expect(
      changesFromScheduleUpdate({
        previousKickoffAt: '2026-10-26T16:00:00.000Z',
        kickoffAt: '2026-10-26T16:00:00.000Z',
        previousVenueName: 'Field A',
        venueName: 'Field A',
        previousVenueAddress: '123 Main',
        venueAddress: '123 Main',
      }),
    ).toBeNull();
  });
});

describe('extractCrewUserIds', () => {
  it('skips outside appointment sentinel ids', () => {
    expect(
      extractCrewUserIds({
        mo: [{ userId: 'ref-1' }, { userId: '__outside_appointment__' }],
        ar1: [{ userId: 'ar-1' }],
        ar2: [],
        no4: [],
      }),
    ).toEqual(['ref-1', 'ar-1']);
  });
});

describe('extractCmoUserIds', () => {
  it('returns unique named CMO user ids', () => {
    expect(
      extractCmoUserIds([
        { userId: 'cmo-1' },
        { userId: 'cmo-1' },
        { userId: '' },
      ]),
    ).toEqual(['cmo-1']);
  });
});
