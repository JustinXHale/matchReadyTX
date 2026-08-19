import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
  type AppCheck,
} from 'firebase/app-check';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getFunctions, type Functions } from 'firebase/functions';

/**
 * Auth helper domain must match how we sign in:
 * - localhost → *.firebaseapp.com (redirect/popup storage works with Firebase’s helper)
 * - Hosting (*.web.app) → same host (avoids third-party storage blocks)
 * See https://firebase.google.com/docs/auth/web/redirect-best-practices
 */
function resolveAuthDomain(): string | undefined {
  const fromEnv = (
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined
  )?.trim();
  const projectId = (
    import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined
  )?.trim();
  if (typeof window === 'undefined') return fromEnv;

  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') {
    return projectId ? `${projectId}.firebaseapp.com` : fromEnv;
  }
  if (host.endsWith('.web.app') || host.endsWith('.firebaseapp.com')) {
    return host;
  }
  return fromEnv || host;
}

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: resolveAuthDomain(),
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as
    | string
    | undefined,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as
    | string
    | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
};

/** True when web config is present — Auth/Firestore can run (even if demo data is on). */
export const isFirebaseConfigured = Boolean(
  config.apiKey &&
    config.apiKey.length > 0 &&
    config.projectId &&
    config.appId,
);

/**
 * Showcase kill switch — when true, `/demo`, Try demo, and Demo|Live toggle are available.
 * Does NOT mean “fake auth”; does NOT disable Google/Apple when Firebase is configured.
 */
export const isDemoMode = import.meta.env.VITE_DEMO_MODE !== 'false';

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let functions: Functions | null = null;
let appCheck: AppCheck | null = null;

if (isFirebaseConfigured) {
  app = initializeApp(config);
  auth = getAuth(app);
  db = getFirestore(app);
  functions = getFunctions(app);

  const recaptchaSiteKey = (
    import.meta.env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY as string | undefined
  )?.trim();
  if (recaptchaSiteKey) {
    if (import.meta.env.DEV && import.meta.env.VITE_APP_CHECK_DEBUG === 'true') {
      // Register debug token in Firebase Console → App Check when enforcing locally.
      (globalThis as { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN =
        true;
    }
    appCheck = initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(recaptchaSiteKey),
      isTokenAutoRefreshEnabled: true,
    });
  }
}

export { app, auth, db, functions, appCheck };
