export type AppFeedbackSeverity = 'success' | 'info' | 'warning' | 'error';

export const APP_FEEDBACK_EVENT = 'rs-app-feedback';

/** Sends app feedback from non-React code without falling back to browser alerts. */
export function notifyApp(
  message: string,
  severity: AppFeedbackSeverity = 'info',
): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(APP_FEEDBACK_EVENT, { detail: { message, severity } }),
  );
}
