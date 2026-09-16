import { describe, expect, it } from 'vitest';
import {
  COMPLIANCE_HOLD_CONTACT,
  COMPLIANCE_HOLD_SOCIETY_NAME,
  applyComplianceHold,
  clearComplianceHold,
  complianceHoldCardLabel,
  complianceHoldContactLine,
  complianceHoldFixtureLine,
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

  it('uses TRRA default template when blank', () => {
    const held = applyComplianceHold(baseMatch(), {
      uid: 'u1',
      displayName: 'Alex Assigner',
      email: 'alex@example.com',
      phone: '555-0100',
    }, '   ');
    expect(held.complianceHold?.message).toContain('MATCH ON HOLD');
    expect(held.complianceHold?.message).toContain(COMPLIANCE_HOLD_SOCIETY_NAME);
    expect(held.complianceHold?.message).toContain('OFFICIAL NOTICE');
    expect(held.complianceHold?.message).toContain('Justin X. Hale');
    expect(held.complianceHold?.message).toContain('justinxhale@gmail.com');
    expect(held.complianceHold?.lockedByName).toBe(COMPLIANCE_HOLD_CONTACT.name);
  });

  it('builds default message with team placeholders', () => {
    const msg = defaultComplianceHoldMessage(baseMatch(), {
      displayName: 'Alex Assigner',
    });
    expect(msg).toContain('Home FC vs Away FC');
    expect(msg).toContain(COMPLIANCE_HOLD_SOCIETY_NAME);
    expect(msg).toContain('justinxhale@gmail.com');
    expect(msg).toContain('WhatsApp or GroupMe');
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

  it('formats fixture line with date and teams', () => {
    const line = complianceHoldFixtureLine(
      {
        ...baseMatch(),
        kickoffAt: '2027-09-18T19:00:00.000Z',
        homeTeamName: 'Austin RFC',
        awayTeamName: 'Dallas RFC',
      },
      'America/Chicago',
    );
    expect(line).toContain('Saturday');
    expect(line).toContain('Sep.');
    expect(line).toContain('2027');
    expect(line).toContain('Austin RFC v Dallas RFC');
  });

  it('formats contact line from hold fields', () => {
    const held = applyComplianceHold(baseMatch(), {
      uid: 'u1',
      displayName: 'Alex',
      email: 'alex@example.com',
      phone: '555-0100',
    }, 'On hold');
    expect(complianceHoldContactLine(held.complianceHold!)).toBe(
      'justinxhale@gmail.com · (979) 703-0894 · WhatsApp or GroupMe',
    );
  });
});
