import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PromoBanner } from './PromoBanner';
import type { PromotionsFeed } from './promotionsFeed';

const feed: PromotionsFeed = {
  paused: false,
  rotationMs: 7000,
  items: [
    {
      id: 'first',
      title: 'First offer',
      subtitle: 'First brand',
      destinationUrl: 'https://example.com/first',
      backgroundColor: '#000000',
      primaryTextColor: '#FFFFFF',
      secondaryTextColor: '#FFFFFF',
      accentColor: '#FFFFFF',
    },
    {
      id: 'second',
      title: 'Second offer',
      priceDisplay: '25',
      priceQualifier: 'From',
      destinationUrl: 'https://example.com/second',
      backgroundColor: '#000000',
      primaryTextColor: '#FFFFFF',
      secondaryTextColor: '#FFFFFF',
      accentColor: '#FFFFFF',
    },
  ],
};

describe('PromoBanner', () => {
  it('opens safely in a new tab and supports keyboard rotation', () => {
    render(<PromoBanner feed={feed} placement="compact" />);

    const firstLink = screen.getByRole('link', { name: /First offer/ });
    expect(firstLink.getAttribute('target')).toBe('_blank');
    expect(firstLink.getAttribute('rel')).toContain('noopener');

    fireEvent.keyDown(firstLink, { key: 'ArrowRight' });

    const secondLink = screen.getByRole('link', { name: /Second offer/ });
    expect(secondLink.getAttribute('href')).toBe('https://example.com/second');
    expect(screen.getByText('From $25')).toBeTruthy();
  });
});
