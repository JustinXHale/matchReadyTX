/** Official-style Google / Apple sign-in controls (matched to TO3 login). */

export function GoogleGIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      aria-hidden
      focusable="false"
    >
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

export function AppleLogoIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden
      focusable="false"
      fill="currentColor"
    >
      <path d="M16.365 1.43c0 1.14-.42 2.2-1.18 3.02-.8.86-2.1 1.52-3.2 1.43-.14-1.1.4-2.28 1.14-3.08.82-.9 2.22-1.56 3.24-1.37zM20.9 17.2c-.58 1.34-.86 1.94-1.62 3.12-1.05 1.62-2.54 3.64-4.38 3.66-1.64.02-2.06-1.06-4.28-1.05-2.22.01-2.68 1.07-4.32 1.05-1.84-.02-3.24-1.84-4.3-3.46C.3 17.3-.9 12.7.9 9.6c1.14-1.98 2.94-3.14 4.64-3.14 1.72 0 2.8 1.1 4.22 1.1 1.38 0 2.22-1.12 4.22-1.12 1.5 0 3.08.82 4.2 2.24-3.7 2.02-3.1 7.3.72 8.52z" />
    </svg>
  );
}

type SocialButtonProps = {
  busy?: boolean;
  disabled?: boolean;
  onClick: () => void;
};

export function GoogleSignInButton({
  busy,
  disabled,
  onClick,
}: SocialButtonProps) {
  return (
    <button
      type="button"
      className="rs-social-btn rs-social-btn--google"
      disabled={disabled || busy}
      onClick={onClick}
    >
      {busy ? (
        <span className="rs-social-btn__spinner" aria-hidden />
      ) : (
        <GoogleGIcon />
      )}
      <span>{busy ? 'Signing in…' : 'Continue with Google'}</span>
    </button>
  );
}

export function AppleSignInButton({
  busy,
  disabled,
  onClick,
}: SocialButtonProps) {
  return (
    <button
      type="button"
      className="rs-social-btn rs-social-btn--apple"
      disabled={disabled || busy}
      onClick={onClick}
    >
      {busy ? (
        <span
          className="rs-social-btn__spinner rs-social-btn__spinner--on-dark"
          aria-hidden
        />
      ) : (
        <AppleLogoIcon />
      )}
      <span>{busy ? 'Signing in…' : 'Sign in with Apple'}</span>
    </button>
  );
}
