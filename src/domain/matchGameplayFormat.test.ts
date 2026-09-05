import { describe, expect, it } from 'vitest';
import {
  gameplayFormatFromLabel,
  matchGameplayFormat,
  matchGameplayFormatResolved,
} from '@/domain/matchGameplayFormat';

describe('matchGameplayFormat', () => {
  it('parses rugby side counts from schedule labels', () => {
    expect(gameplayFormatFromLabel('15s')).toBe('15s');
    expect(gameplayFormatFromLabel('7s Tournament')).toBe('7s');
    expect(gameplayFormatFromLabel('10-a-side')).toBe('10s');
    expect(gameplayFormatFromLabel('2nd Side')).toBeNull();
    expect(gameplayFormatFromLabel(undefined)).toBeNull();
  });

  it('falls back to title and competition when match_type is empty', () => {
    expect(
      matchGameplayFormat({
        title: 'Spring 7s',
        matchType: '2nd Side',
      }),
    ).toBe('7s');
    expect(
      matchGameplayFormat({
        competition: 'Collegiate XV',
        matchType: undefined,
      }),
    ).toBe('15s');
  });

  it('defaults unlabeled matches to 15s', () => {
    expect(
      matchGameplayFormatResolved({
        matchType: '2nd Side',
      }),
    ).toBe('15s');
  });
});
