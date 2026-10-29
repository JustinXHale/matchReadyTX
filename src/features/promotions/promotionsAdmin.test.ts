import { describe, expect, it } from 'vitest';
import {
  derivePublishedItems,
  duplicatePromotionDraft,
  type PromotionDraft,
} from './promotionsAdmin';

const base: PromotionDraft = {
  id: 'training-ball',
  title: 'Training ball',
  destinationUrl: 'https://example.com/ball',
  backgroundColor: '#000000',
  primaryTextColor: '#FFFFFF',
  secondaryTextColor: '#FFFFFF',
  accentColor: '#FFFFFF',
  active: true,
  sortOrder: 0,
  targetMode: 'apps',
  targetAppIds: ['matchreadytx'],
};

describe('promotionsAdmin', () => {
  it('duplicates a promotion with a unique id and final sort order', () => {
    const existing = [
      base,
      { ...base, id: 'training-ball-copy', sortOrder: 1 },
    ];
    const copy = duplicatePromotionDraft(base, existing);

    expect(copy.id).toBe('training-ball-copy-2');
    expect(copy.title).toBe('Training ball copy');
    expect(copy.sortOrder).toBe(2);
  });

  it('publishes only active, current, targeted drafts in sort order', () => {
    const items = derivePublishedItems(
      [
        { ...base, id: 'later', title: 'Later', sortOrder: 2 },
        { ...base, id: 'first', title: 'First', sortOrder: 0 },
        { ...base, id: 'inactive', active: false, sortOrder: 1 },
        {
          ...base,
          id: 'future',
          startsAt: '2030-01-01T00:00',
          sortOrder: 3,
        },
        {
          ...base,
          id: 'other-app',
          targetAppIds: ['to3'],
          sortOrder: 4,
        },
      ],
      'matchreadytx',
      new Date('2026-10-28T12:00:00'),
    );

    expect(items.map((item) => item.id)).toEqual(['first', 'later']);
  });
});
