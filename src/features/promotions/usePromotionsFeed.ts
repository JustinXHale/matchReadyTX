import { useEffect, useState } from 'react';
import {
  getFreshCachedPromotionsFeed,
  isPromotionsCacheStale,
  isPromotionsConfigured,
  loadPromotionsFeed,
  type PromotionsFeed,
} from './promotionsFeed';

export function usePromotionsFeed(enabled: boolean): PromotionsFeed | null {
  const [feed, setFeed] = useState<PromotionsFeed | null>(null);

  useEffect(() => {
    if (!enabled || !isPromotionsConfigured) {
      setFeed(null);
      return;
    }

    let active = true;
    setFeed(getFreshCachedPromotionsFeed());

    const refresh = async (force = false) => {
      const next = await loadPromotionsFeed({ force });
      if (active) setFeed(next);
    };

    void refresh();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isPromotionsCacheStale()) {
        void refresh(true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      active = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled]);

  return feed && !feed.paused && feed.items.length > 0 ? feed : null;
}
