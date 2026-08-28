import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  appBackLabel,
  backState,
  canPopAppHistory,
  goAppBack,
  readBackNav,
} from '@/nav/backNav';

const fallback = { to: '/home', label: 'Home' };

describe('readBackNav', () => {
  it('reads nested back state', () => {
    const state = backState({ to: '/members', label: 'Members' });
    expect(readBackNav(state)).toEqual({ to: '/members', label: 'Members' });
  });

  it('returns null for invalid state', () => {
    expect(readBackNav(null)).toBeNull();
    expect(readBackNav({ back: { to: '', label: 'x' } })).toBeNull();
  });
});

describe('canPopAppHistory', () => {
  const originalHistory = window.history;

  beforeEach(() => {
    Object.defineProperty(window, 'history', {
      configurable: true,
      value: { ...originalHistory, state: { idx: 0 } },
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'history', {
      configurable: true,
      value: originalHistory,
    });
  });

  it('is false at history root', () => {
    expect(canPopAppHistory()).toBe(false);
  });

  it('is true when idx > 0', () => {
    Object.defineProperty(window, 'history', {
      configurable: true,
      value: { ...originalHistory, state: { idx: 2 } },
    });
    expect(canPopAppHistory()).toBe(true);
  });
});

describe('appBackLabel', () => {
  it('uses generic Back when history can pop', () => {
    Object.defineProperty(window, 'history', {
      configurable: true,
      value: { ...window.history, state: { idx: 1 } },
    });
    expect(appBackLabel(null, fallback)).toBe('Back');
  });

  it('uses fallback label when history cannot pop', () => {
    Object.defineProperty(window, 'history', {
      configurable: true,
      value: { ...window.history, state: { idx: 0 } },
    });
    expect(appBackLabel(null, fallback)).toBe('Back to Home');
  });
});

describe('goAppBack', () => {
  it('pops history when possible', () => {
    Object.defineProperty(window, 'history', {
      configurable: true,
      value: { ...window.history, state: { idx: 1 } },
    });
    const navigate = vi.fn();
    goAppBack(navigate, { fallback });
    expect(navigate).toHaveBeenCalledWith(-1);
  });

  it('navigates to explicit back when history cannot pop', () => {
    Object.defineProperty(window, 'history', {
      configurable: true,
      value: { ...window.history, state: { idx: 0 } },
    });
    const navigate = vi.fn();
    const state = backState({ to: '/members', label: 'Members' });
    goAppBack(navigate, { fallback, fromState: state });
    expect(navigate).toHaveBeenCalledWith('/members', undefined);
  });

  it('uses fallback when no back state and history cannot pop', () => {
    Object.defineProperty(window, 'history', {
      configurable: true,
      value: { ...window.history, state: { idx: 0 } },
    });
    const navigate = vi.fn();
    goAppBack(navigate, { fallback, fromState: null });
    expect(navigate).toHaveBeenCalledWith('/home', undefined);
  });
});
