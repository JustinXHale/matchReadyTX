import { Button } from '@patternfly/react-core';
import { usePwaInstall } from '@/pwa/usePwaInstall';

type PwaInstallCardProps = {
  /** Extra class on the outer card (e.g. login spacing). */
  className?: string;
};

/**
 * Nudge to install the PWA (Chrome/Edge prompt, or iOS Share → Add to Home Screen).
 */
export function PwaInstallCard({ className }: PwaInstallCardProps) {
  const { mode, install, dismiss } = usePwaInstall();

  if (mode === 'hidden') return null;

  return (
    <aside
      className={`rs-pwa-install${className ? ` ${className}` : ''}`}
      aria-label="Install MatchReadyTX"
    >
      <img
        className="rs-pwa-install__icon"
        src="/pwa-192.png"
        alt=""
        width={40}
        height={40}
        decoding="async"
      />
      <div className="rs-pwa-install__body">
        <p className="rs-pwa-install__title">Install MatchReadyTX</p>
        {mode === 'prompt' ? (
          <p className="rs-pwa-install__text">
            Add a desktop or home-screen shortcut for quicker access.
          </p>
        ) : (
          <p className="rs-pwa-install__text">
            Tap Share, then <strong>Add to Home Screen</strong> to install.
          </p>
        )}
        <div className="rs-pwa-install__actions">
          {mode === 'prompt' && (
            <Button
              variant="secondary"
              onClick={() => {
                void install();
              }}
            >
              Install
            </Button>
          )}
          <Button variant="link" onClick={dismiss}>
            Not now
          </Button>
        </div>
      </div>
    </aside>
  );
}
