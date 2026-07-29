import { Button } from '@patternfly/react-core';
import { useLayoutEffect, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { defaultRoleView, ROLE_HOME, useApp } from '@/app/AppContext';
import { signInWithApple, signInWithGoogle } from '@/services/auth';
import { isFirebaseConfigured } from '@/services/firebase';
import { safeNextPath } from '@/services/appLinks';
import {
  AppleSignInButton,
  GoogleSignInButton,
} from '@/features/auth/SocialSignInButtons';

function authErrorMessage(provider: 'Google' | 'Apple', err: unknown): string {
  const message =
    err instanceof Error ? err.message : `${provider} sign-in failed.`;
  if (message.includes('auth/operation-not-allowed')) {
    return `${provider} sign-in is not enabled yet. In Firebase Console → Authentication → Sign-in method, enable ${provider}, then try again.`;
  }
  if (message.includes('auth/popup-closed-by-user')) {
    return 'Sign-in was cancelled.';
  }
  if (message.includes('auth/popup-blocked')) {
    return 'Pop-up blocked. Allow pop-ups for this site (or use Chrome, not the IDE browser), then try again.';
  }
  if (
    message.includes('invalid_client') ||
    message.includes('auth/invalid-credential')
  ) {
    return 'Apple sign-in is still finishing setup. Try Google, or re-save the Services ID in Apple Developer.';
  }
  return message;
}

export function LoginPage() {
  const {
    enterLive,
    liveProfile,
    hasFirebaseSession,
    dataMode,
    isDemoMode: showcaseEnabled,
    setRoleView,
    authBootstrapError,
  } = useApp();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const nextPath = safeNextPath(searchParams.get('next'));
  const [authNote, setAuthNote] = useState<string | null>(null);
  const [busyProvider, setBusyProvider] = useState<'google' | 'apple' | null>(
    null,
  );

  useLayoutEffect(() => {
    if (hasFirebaseSession && liveProfile && dataMode !== 'live') {
      enterLive();
    }
  }, [hasFirebaseSession, liveProfile, dataMode, enterLive]);

  useLayoutEffect(() => {
    if (hasFirebaseSession && liveProfile && dataMode === 'live') {
      setRoleView(defaultRoleView(liveProfile));
      setBusyProvider(null);
    }
  }, [hasFirebaseSession, liveProfile, dataMode, setRoleView]);

  useLayoutEffect(() => {
    if (authBootstrapError) setBusyProvider(null);
  }, [authBootstrapError]);

  if (hasFirebaseSession && liveProfile && dataMode === 'live') {
    const view = defaultRoleView(liveProfile);
    const dest = liveProfile.profileComplete
      ? (nextPath ?? ROLE_HOME[view])
      : '/onboarding';
    return <Navigate to={dest} replace />;
  }

  const busy = busyProvider != null;
  const statusNote = authNote ?? authBootstrapError;

  const tryDemo = () => {
    navigate('/demo');
  };

  const onGoogle = async () => {
    if (!isFirebaseConfigured) {
      setAuthNote(
        'Firebase is not configured. Add VITE_FIREBASE_* to .env.local, or use Try demo.',
      );
      return;
    }
    setBusyProvider('google');
    setAuthNote(null);
    try {
      const user = await signInWithGoogle();
      // Redirect leaves the page; popup success keeps busy until Navigate.
      if (!user) setBusyProvider(null);
    } catch (err) {
      setAuthNote(authErrorMessage('Google', err));
      setBusyProvider(null);
    }
  };

  const onApple = async () => {
    if (!isFirebaseConfigured) {
      setAuthNote(
        'Firebase is not configured. Add VITE_FIREBASE_* to .env.local, or use Try demo.',
      );
      return;
    }
    setBusyProvider('apple');
    setAuthNote(null);
    try {
      const user = await signInWithApple();
      if (!user) setBusyProvider(null);
    } catch (err) {
      setAuthNote(authErrorMessage('Apple', err));
      setBusyProvider(null);
    }
  };

  return (
    <div className="rs-signin">
      <header className="rs-signin__hero">
        <p className="rs-signin__brand">MatchReadyTX</p>
        <p className="rs-signin__lede">
          Sign in securely with your Google or Apple account
        </p>
        {isFirebaseConfigured && (
          <p className="rs-signin__legal">
            Connected to Firebase project matchreadytx
          </p>
        )}
      </header>

      <section className="rs-signin__providers" aria-label="Sign in">
        <GoogleSignInButton
          busy={busyProvider === 'google'}
          disabled={busy}
          onClick={() => void onGoogle()}
        />
        <AppleSignInButton
          busy={busyProvider === 'apple'}
          disabled={busy}
          onClick={() => void onApple()}
        />
        {showcaseEnabled && (
          <Button
            variant="link"
            isBlock
            className="rs-signin__provider"
            isDisabled={busy}
            onClick={tryDemo}
          >
            Try demo
          </Button>
        )}
        {statusNote && (
          <p className="rs-signin__note" role="status">
            {statusNote}
          </p>
        )}
      </section>
    </div>
  );
}
