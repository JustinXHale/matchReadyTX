import {
  GoogleAuthProvider,
  OAuthProvider,
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type AuthProvider,
  type User,
} from 'firebase/auth';
import { auth, isFirebaseConfigured } from '@/services/firebase';

const googleProvider = new GoogleAuthProvider();
const appleProvider = new OAuthProvider('apple.com');
appleProvider.addScope('email');
appleProvider.addScope('name');

export function requireAuth() {
  if (!isFirebaseConfigured || !auth) {
    throw new Error(
      'Firebase Auth is not configured. Check VITE_FIREBASE_* in .env.local.',
    );
  }
  return auth;
}

function isPopupBlockedError(err: unknown): boolean {
  const code =
    err && typeof err === 'object' && 'code' in err
      ? String((err as { code: unknown }).code)
      : '';
  // Only true blocks — do NOT treat cancelled-popup-request as blocked.
  return (
    code === 'auth/popup-blocked' ||
    (err instanceof Error &&
      /popup/i.test(err.message) &&
      /blocked/i.test(err.message))
  );
}

export function isMissingRedirectStateError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return message.includes('missing initial state');
}

const POPUP_BLOCKED_HELP =
  'Sign-in pop-up was blocked. Allow pop-ups for MatchReadyTX, or open this site in Safari or Chrome (not an in-app or private browser), then try again.';

/**
 * Popup-only sign-in. Redirect auth loses sessionStorage on many mobile and
 * privacy browsers ("missing initial state") — see Firebase redirect best practices.
 */
async function signInWithProvider(
  provider: AuthProvider,
): Promise<User | null> {
  const a = requireAuth();
  try {
    const result = await signInWithPopup(a, provider);
    return result.user;
  } catch (err) {
    if (isPopupBlockedError(err)) {
      throw new Error(POPUP_BLOCKED_HELP);
    }
    throw err;
  }
}

export async function signInWithGoogle(): Promise<User | null> {
  return signInWithProvider(googleProvider);
}

export async function signInWithApple(): Promise<User | null> {
  return signInWithProvider(appleProvider);
}

/** Complete a stale redirect sign-in if present (usually no-op with popup auth). */
export async function completeRedirectSignIn(): Promise<User | null> {
  if (!isFirebaseConfigured || !auth) return null;
  try {
    const result = await getRedirectResult(auth);
    return result?.user ?? null;
  } catch (err) {
    if (isMissingRedirectStateError(err)) {
      console.warn('Ignoring stale redirect sign-in state', err);
      return null;
    }
    throw err;
  }
}

export async function signOutFirebase(): Promise<void> {
  if (!auth) return;
  await firebaseSignOut(auth);
}

/** Subscribe to Firebase Auth; no-op when Firebase is not configured. */
export function subscribeAuth(
  onUser: (user: User | null) => void,
): () => void {
  if (!isFirebaseConfigured || !auth) {
    onUser(null);
    return () => undefined;
  }
  return onAuthStateChanged(auth, onUser);
}
