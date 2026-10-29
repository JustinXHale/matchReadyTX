import { describe, expect, it } from 'vitest';
import { parsePromotionsFeed } from './promotionsFeed';

describe('parsePromotionsFeed', () => {
  it('keeps only safe, displayable items and constrains rotation', () => {
    const feed = parsePromotionsFeed({
      paused: false,
      rotationMs: 100,
      items: [
        {
          id: 'legacy-kit',
          title: 'Legacy match kit',
          subtitle: 'Built for match day',
          priceDisplay: '49',
          priceQualifier: 'From',
          destinationUrl: 'https://legacyecowear.com/products/kit',
          imageUrl: 'https://cdn.example.com/kit.webp',
          backgroundColor: '#000000',
          primaryTextColor: '#CEAA6F',
          secondaryTextColor: '#8A6E42',
          accentColor: '#CEAA6F',
        },
        {
          id: 'unsafe',
          title: 'Unsafe URL',
          destinationUrl: 'javascript:alert(1)',
        },
      ],
    });

    expect(feed?.rotationMs).toBe(3000);
    expect(feed?.items).toHaveLength(1);
    expect(feed?.items[0]).toMatchObject({
      id: 'legacy-kit',
      destinationUrl: 'https://legacyecowear.com/products/kit',
      imageUrl: 'https://cdn.example.com/kit.webp',
    });
  });

  it('replaces low-contrast and malformed colors with safe values', () => {
    const feed = parsePromotionsFeed({
      items: [
        {
          id: 'contrast',
          title: 'Readable promotion',
          destinationUrl: 'https://example.com/',
          backgroundColor: '#FFFFFF',
          primaryTextColor: '#FFFFFF',
          secondaryTextColor: 'red',
        },
      ],
    });

    expect(feed?.items[0]?.primaryTextColor).toBe('#000000');
    expect(feed?.items[0]?.secondaryTextColor).toBe('#000000');
  });
});
