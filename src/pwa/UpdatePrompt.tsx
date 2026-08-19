import { useEffect, useRef, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000; // check every hour

/**
 * Toast when a new service-worker build is available; Reload applies it (hard refresh).
 */
export function UpdatePrompt() {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const [isApplying, setIsApplying] = useState(false);

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      registrationRef.current = registration;
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => {
        void registration.update();
      }, UPDATE_CHECK_INTERVAL_MS);
    },
  });

  const applyUpdate = async () => {
    if (isApplying) return;
    setIsApplying(true);

    let didReload = false;
    const finishReload = () => {
      if (didReload) return;
      didReload = true;
      window.location.reload();
    };

    const reloadTimer = window.setTimeout(finishReload, 2500);
    const onControllerChange = () => {
      window.clearTimeout(reloadTimer);
      finishReload();
    };

    navigator.serviceWorker?.addEventListener('controllerchange', onControllerChange, {
      once: true,
    });

    try {
      await updateServiceWorker(true);
      registrationRef.current?.waiting?.postMessage({ type: 'SKIP_WAITING' });
    } finally {
      // Fallback if controllerchange doesn't fire in this browser state.
      window.clearTimeout(reloadTimer);
      window.setTimeout(finishReload, 150);
      setIsApplying(false);
    }
  };

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  if (!needRefresh) return null;

  return (
    <div className="rs-update-toast" role="alert">
      <span className="rs-update-toast__text">A new version is available.</span>
      <button
        type="button"
        className="rs-update-toast__btn"
        onClick={() => void applyUpdate()}
        disabled={isApplying}
      >
        {isApplying ? 'Updating...' : 'Reload'}
      </button>
    </div>
  );
}
