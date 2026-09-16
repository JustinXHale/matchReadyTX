import { describe, expect, it } from 'vitest';
import {
  applyComplianceHold,
  clearComplianceHold,
  complianceHoldCardLabel,
  complianceHoldContactLine,
  defaultComplianceHoldMessage,
  isComplianceHeld,
  shouldShowComplianceHoldUi,
} from '@/domain/complianceHold';
import { emptyCrew, type Match } from '@/domain/types';

function baseMatch(): Match {
  return {
    id: 'm1',
    sheetRowKey: 's1',
    homeTeamId: 'h1',
    awayTeamId: 'a1',
    homeTeamName: 'Home FC',
    awayTeamName: 'Away FC',
    kickoffAt: '2026-09-20T18:00:00.000Z',
    venueName: 'Main Field',
    venueAddress: 'Austin, TX',
    gender: 'women',
    level: 'D1',
    status: 'crew_pending',
    flightProvided: false,
    housingProvided: false,
    crew: emptyCrew(),
  };
}

describe('complianceHold', () => {
  it('detects active hold from lockedAt', () => {
    const held = applyComplianceHold(baseMatch(), {
      uid: 'u1',
      displayName: 'Alex Assigner',
      email: 'alex@example.com',
      phone: '',
    }, 'Hold message');
    expect(isComplianceHeld(held)).toBe(true);
    expect(isComplianceHeld(baseMatch())).toBe(false);
  });

  it('uses default message when blank', () => {
    const held = applyComplianceHold(baseMatch(), {
      uid: 'u1',
      displayName: 'Alex Assigner',
      email: 'alex@example.com',
      phone: '555-0100',
    }, '   ');
    expect(held.complianceHold?.message).toContain('Alex Assigner');
    expect(held.complianceHold?.message).toContain('alex@example.com');
  });

  it('builds default message with contact fallback', () => {
    const msg = defaultComplianceHoldMessage({
      displayName: 'Scheduler',
      email: '',
      phone: '',
    });
    expect(msg).toContain('the assigner');
  });

  it('clears hold', () => {
    const held = applyComplianceHold(baseMatch(), {
      uid: 'u1',
      displayName: 'Alex',
      email: 'alex@example.com',
      phone: '',
    }, 'On hold');
    const cleared = clearComplianceHold(held);
    expect(cleared.complianceHold).toBeUndefined();
    expect(isComplianceHeld(cleared)).toBe(false);
  });

  it('exposes assertive card label', () => {
    expect(complianceHoldCardLabel()).toContain('Locked by assigner');
    expect(complianceHoldCardLabel()).toContain('compliant');
  });

  it('shows lock UI only on team admin, referee, and fan lenses', () => {
    expect(shouldShowComplianceHoldUi('teamAdmin')).toBe(true);
    expect(shouldShowComplianceHoldUi('referee')).toBe(true);
    expect(shouldShowComplianceHoldUi('fan')).toBe(true);
    expect(shouldShowComplianceHoldUi('scheduler')).toBe(false);
    expect(shouldShowComplianceHoldUi('judicial')).toBe(false);
  });

  it('formats contact line from hold fields', () => {
    const held = applyComplianceHold(baseMatch(), {
      uid: 'u1',
      displayName: 'Alex',
      email: 'alex@example.com',
      phone: '555-0100',
    }, 'On hold');
    expect(complianceHoldContactLine(held.complianceHold!)).toBe(
      'alex@example.com · 555-0100',
    );
  });
});
