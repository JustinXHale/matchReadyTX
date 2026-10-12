import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Snackbar,
} from '@mui/material';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  APP_FEEDBACK_EVENT,
  type AppFeedbackSeverity,
} from '@/app/feedback/feedbackBus';
import {
  AppFeedbackContext,
  type ConfirmOptions,
} from '@/app/feedback/feedbackContext';

type Notice = {
  key: number;
  message: string;
  severity: AppFeedbackSeverity;
};

type PendingConfirmation = ConfirmOptions & {
  resolve: (confirmed: boolean) => void;
};

export function AppFeedbackProvider({ children }: { children: ReactNode }) {
  const [notice, setNotice] = useState<Notice | null>(null);
  const [confirmation, setConfirmation] =
    useState<PendingConfirmation | null>(null);
  const confirmationRef = useRef<PendingConfirmation | null>(null);

  const notify = useCallback(
    (message: string, severity: AppFeedbackSeverity = 'info') => {
      setNotice({ key: Date.now(), message, severity });
    },
    [],
  );

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        confirmationRef.current?.resolve(false);
        const pending = { ...options, resolve };
        confirmationRef.current = pending;
        setConfirmation(pending);
      }),
    [],
  );

  const finishConfirmation = useCallback((confirmed: boolean) => {
    const pending = confirmationRef.current;
    confirmationRef.current = null;
    setConfirmation(null);
    pending?.resolve(confirmed);
  }, []);

  useEffect(() => {
    const receiveFeedback = (event: Event) => {
      const detail = (event as CustomEvent<{
        message?: unknown;
        severity?: unknown;
      }>).detail;
      if (!detail || typeof detail.message !== 'string') return;
      const severity: AppFeedbackSeverity =
        detail.severity === 'success' ||
        detail.severity === 'warning' ||
        detail.severity === 'error'
          ? detail.severity
          : 'info';
      notify(detail.message, severity);
    };
    window.addEventListener(APP_FEEDBACK_EVENT, receiveFeedback);
    return () =>
      window.removeEventListener(APP_FEEDBACK_EVENT, receiveFeedback);
  }, [notify]);

  useEffect(
    () => () => {
      confirmationRef.current?.resolve(false);
    },
    [],
  );

  const value = useMemo(() => ({ notify, confirm }), [confirm, notify]);

  return (
    <AppFeedbackContext.Provider value={value}>
      {children}
      <Snackbar
        key={notice?.key}
        open={Boolean(notice)}
        autoHideDuration={notice?.severity === 'error' ? 7000 : 5000}
        onClose={(_, reason) => {
          if (reason !== 'clickaway') setNotice(null);
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        className="rs-app-snackbar"
      >
        {notice ? (
          <Alert
            severity={notice.severity}
            variant="filled"
            onClose={() => setNotice(null)}
            sx={{ width: '100%' }}
          >
            {notice.message}
          </Alert>
        ) : undefined}
      </Snackbar>

      <Dialog
        open={Boolean(confirmation)}
        onClose={() => finishConfirmation(false)}
        aria-labelledby="app-confirm-title"
        aria-describedby="app-confirm-message"
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle id="app-confirm-title">
          {confirmation?.title ?? 'Confirm action'}
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="app-confirm-message">
            {confirmation?.message}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => finishConfirmation(false)}
            autoFocus={Boolean(confirmation?.destructive)}
          >
            {confirmation?.cancelLabel ?? 'Cancel'}
          </Button>
          <Button
            variant="contained"
            color={confirmation?.destructive ? 'error' : 'primary'}
            onClick={() => finishConfirmation(true)}
            autoFocus={!confirmation?.destructive}
          >
            {confirmation?.confirmLabel ?? 'Continue'}
          </Button>
        </DialogActions>
      </Dialog>
    </AppFeedbackContext.Provider>
  );
}
