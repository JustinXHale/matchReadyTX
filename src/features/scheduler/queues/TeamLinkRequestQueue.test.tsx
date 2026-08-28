import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { TeamLinkRequest } from '@/domain/types';
import { TeamLinkRequestQueue } from './TeamLinkRequestQueue';

const req: TeamLinkRequest = {
  id: 'tlr1',
  orgId: 'org',
  requesterUserId: 'u1',
  requesterName: 'Troy',
  requesterEmail: 'troy@example.com',
  teamId: 'tcu',
  teamName: 'Texas Christian University',
  status: 'pending',
  createdAt: '2026-01-01',
};

describe('TeamLinkRequestQueue', () => {
  it('puts Approve and Deny side by side with a solid red Deny', () => {
    render(
      <TeamLinkRequestQueue
        requests={[req]}
        busyId={null}
        onApprove={vi.fn()}
        onDeny={vi.fn()}
      />,
    );
    const deny = screen.getByRole('button', { name: 'Deny' });
    expect(deny.className).toMatch(/pf-m-danger/);
    expect(deny.className).toMatch(/rs-btn--danger/);
    const row = deny.closest('.rs-actions');
    expect(row?.className).toContain('rs-actions--inline');
    expect(screen.getByRole('button', { name: 'Approve' }).closest('.rs-actions')).toBe(
      row,
    );
  });
});
