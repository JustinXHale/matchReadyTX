import { createContext, useContext } from 'react';
import type { AppFeedbackSeverity } from '@/app/feedback/feedbackBus';

export type ConfirmOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

export type AppFeedbackValue = {
  notify: (message: string, severity?: AppFeedbackSeverity) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};

export const AppFeedbackContext = createContext<AppFeedbackValue | null>(null);

export function useAppFeedback(): AppFeedbackValue {
  const value = useContext(AppFeedbackContext);
  if (!value) {
    throw new Error('useAppFeedback must be used inside AppFeedbackProvider');
  }
  return value;
}
