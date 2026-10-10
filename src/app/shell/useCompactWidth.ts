import { useEffect, useState } from 'react';

/** M3 compact width class: available width under 600dp → navigation bar. */
export const M3_COMPACT_MQ = '(max-width: 599.98px)';

/**
 * True when the window is in the Material 3 compact size class.
 * Compact → bottom navigation bar; medium+ → navigation rail.
 */
export function useCompactWidth(): boolean {
  const [compact, setCompact] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia(M3_COMPACT_MQ).matches
      : true,
  );

  useEffect(() => {
    const mq = window.matchMedia(M3_COMPACT_MQ);
    const onChange = () => setCompact(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return compact;
}
