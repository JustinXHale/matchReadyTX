import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BrandLogo } from '@/ui/BrandLogo';

describe('BrandLogo layout', () => {
  it('uses fluid wrap only for hero-sized logos (not 32px masthead box)', () => {
    const { container } = render(
      <BrandLogo className="rs-signin__logo" width={280} height={280} alt="" />,
    );
    const wrap = container.querySelector('span');
    expect(wrap?.className).toBe('rs-brand-logo-wrap--fluid');
    expect(wrap?.className).not.toContain('rs-brand-logo-wrap ');
    expect(wrap?.className).not.toMatch(/\brs-brand-logo-wrap\b.*\brs-brand-logo-wrap\b/);
  });

  it('uses masthead wrap for 32px icons', () => {
    const { container } = render(<BrandLogo width={32} height={32} alt="" />);
    const wrap = container.querySelector('span');
    expect(wrap?.className).toBe('rs-brand-logo-wrap');
  });
});
