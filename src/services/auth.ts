import {
  GoogleAuthProvider,
  OAuthProvider,
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
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

/** Mobile / iPad — popup auth is unreliable; prefer full-page redirect. */
function prefersRedirectSignIn(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/Android|iPhone|iPad|iPod|Mobile/i.test(ua)) return true;
  // iPadOS desktop UA with touch
  return navigator.maxTouchPoints > 1 && /Macintosh/i.test(ua);
}

function isPopupBlockedError(err: unknown): boolean {
  const code =
    err && typeof err === 'object' && 'code' in err
      ? String((err as { code: unknown }).code)
      : '';
  // Only true blocks — do NOT treat cancelled-popup-request as blocked (causes
  // a bad redirect race). Desktop redirect after block also breaks IDE browsers.
  return (
    code === 'auth/popup-blocked' ||
    (err instanceof Error &&
      /popup/i.test(err.message) &&
      /blocked/i.test(err.message))
  );
}

async function signInWithProvider(
  provider: AuthProvider,
): Promise<User | null> {
  const a = requireAuth();
  if (prefersRedirectSignIn()) {
    await signInWithRedirect(a, provider);
    return null;
  }
  try {
    const result = await signInWithPopup(a, provider);
    return result.user;
  } catch (err) {
    // Mobile only: popup often blocked → full-page redirect.
    // Desktop: surface the error (redirect leaves IDE/Simple Browser on a white
    // __/auth/handler page and never returns a session).
    if (isPopupBlockedError(err) && prefersRedirectSignIn()) {
      await signInWithRedirect(a, provider);
      return null;
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

/** Complete a redirect-based sign-in (no-op when there was no redirect). */
export async function completeRedirectSignIn(): Promise<User | null> {
  if (!isFirebaseConfigured || !auth) return null;
  const result = await getRedirectResult(auth);
  return result?.user ?? null;
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
