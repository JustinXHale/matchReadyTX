import { Button } from '@patternfly/react-core';
import { useLayoutEffect, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { resolveRoleView, ROLE_HOME, useApp } from '@/app/AppContext';
import { signInWithApple, signInWithGoogle } from '@/services/auth';
import { isFirebaseConfigured } from '@/services/firebase';
import { safeNextPath } from '@/services/appLinks';
import {
  AppleSignInButton,
  GoogleSignInButton,
} from '@/features/auth/SocialSignInButtons';
import { appBuildLabel } from '@/app/appBuild';
import { PwaInstallCard } from '@/ui/PwaInstallCard';
import { ThemeToggle } from '@/ui/ThemeToggle';
import { BrandLogo } from '@/ui/BrandLogo';
import { PublicFooter } from '@/features/public/PublicFooter';
import { PublicLandingAbout } from '@/features/public/PublicLandingAbout';
import '@/features/public/public.css';

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

/** Public home + sign-in — satisfies OAuth homepage requirements at `/`. */
export function LoginPage() {
  const {
    enterLive,
    liveProfile,
    hasFirebaseSession,
    dataMode,
    setDataMode,
    store,
    isDemoMode: showcaseEnabled,
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

  /** Public sign-in is never the showcase — drop leftover Try demo session. */
  useLayoutEffect(() => {
    if (hasFirebaseSession) return;
    if (dataMode !== 'demo') return;
    setDataMode('live');
    store.signOut();
  }, [hasFirebaseSession, dataMode, setDataMode, store]);

  useLayoutEffect(() => {
    if (authBootstrapError) setBusyProvider(null);
  }, [authBootstrapError]);

  if (hasFirebaseSession && liveProfile && dataMode === 'live') {
    const view = resolveRoleView(liveProfile);
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
    <div className="rs-signin rs-public">
      <header className="rs-signin__hero rs-public__hero">
        <BrandLogo
          className="rs-signin__logo rs-public__logo"
          width={160}
          height={160}
          alt="MatchReadyTX"
        />
        <h1 className="rs-public__lede">MatchReadyTX</h1>
        <p className="rs-public__tagline">
          Scheduling and match management for rugby referee organizations
        </p>
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

      <PublicLandingAbout />

      <PwaInstallCard className="rs-signin__pwa" />

      <PublicFooter className="rs-signin__footer" />

      <div className="rs-signin__build-row">
        <p className="rs-signin__build">{appBuildLabel()}</p>
        <ThemeToggle />
      </div>
    </div>
  );
}
