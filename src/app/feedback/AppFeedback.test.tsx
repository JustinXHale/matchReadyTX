import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { AppFeedbackProvider } from '@/app/feedback/AppFeedback';
import { useAppFeedback } from '@/app/feedback/feedbackContext';

function FeedbackHarness() {
  const { confirm, notify } = useAppFeedback();
  const [result, setResult] = useState('pending');

  return (
    <>
      <button type="button" onClick={() => notify('Saved successfully', 'success')}>
        Notify
      </button>
      <button
        type="button"
        onClick={() => {
          void confirm({
            title: 'Delete report?',
            message: 'This action cannot be undone.',
            confirmLabel: 'Delete',
            destructive: true,
          }).then((confirmed) => setResult(confirmed ? 'confirmed' : 'cancelled'));
        }}
      >
        Confirm
      </button>
      <output>{result}</output>
    </>
  );
}

describe('AppFeedbackProvider', () => {
  it('shows non-blocking snackbar feedback', () => {
    render(
      <AppFeedbackProvider>
        <FeedbackHarness />
      </AppFeedbackProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Notify' }));
    expect(screen.getByText('Saved successfully')).toBeTruthy();
  });

  it('resolves destructive confirmation through an accessible dialog', async () => {
    render(
      <AppFeedbackProvider>
        <FeedbackHarness />
      </AppFeedbackProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(screen.getByRole('dialog', { name: 'Delete report?' })).toBeTruthy();
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Cancel' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(await screen.findByText('confirmed')).toBeTruthy();
  });
});
