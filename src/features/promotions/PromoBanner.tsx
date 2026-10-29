import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import type { PromotionItem, PromotionsFeed } from './promotionsFeed';

type Props = {
  feed: PromotionsFeed;
  placement: 'compact' | 'medium';
};

type PromoStyle = CSSProperties & {
  '--rs-promo-background': string;
  '--rs-promo-primary': string;
  '--rs-promo-secondary': string;
  '--rs-promo-accent': string;
};

type PointerGesture = {
  id: number;
  startX: number;
  deltaX: number;
};

function displayPrice(item: PromotionItem): string | undefined {
  if (!item.priceDisplay) return undefined;
  const amount = /^\d/.test(item.priceDisplay)
    ? `$${item.priceDisplay}`
    : item.priceDisplay;
  return [item.priceQualifier, amount].filter(Boolean).join(' ');
}

export function PromoBanner({ feed, placement }: Props) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [hasFocus, setHasFocus] = useState(false);
  const [pointerActive, setPointerActive] = useState(false);
  const gesture = useRef<PointerGesture | null>(null);
  const suppressClick = useRef(false);
  const itemCount = feed.items.length;
  const item = feed.items[activeIndex % itemCount]!;

  useEffect(() => {
    setActiveIndex(0);
  }, [feed]);

  useEffect(() => {
    if (itemCount < 2 || hasFocus || pointerActive) return;
    const intervalId = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % itemCount);
    }, feed.rotationMs);
    return () => window.clearInterval(intervalId);
  }, [feed.rotationMs, hasFocus, itemCount, pointerActive]);

  const style = useMemo<PromoStyle>(
    () => ({
      '--rs-promo-background': item.backgroundColor,
      '--rs-promo-primary': item.primaryTextColor,
      '--rs-promo-secondary': item.secondaryTextColor,
      '--rs-promo-accent': item.accentColor,
    }),
    [item],
  );

  const moveBy = (direction: -1 | 1) => {
    setActiveIndex(
      (current) => (current + direction + itemCount) % itemCount,
    );
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLAnchorElement>) => {
    if (itemCount < 2) return;
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      moveBy(-1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      moveBy(1);
    }
  };

  const handlePointerDown = (event: PointerEvent<HTMLAnchorElement>) => {
    setPointerActive(true);
    gesture.current = { id: event.pointerId, startX: event.clientX, deltaX: 0 };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent<HTMLAnchorElement>) => {
    if (gesture.current?.id === event.pointerId) {
      gesture.current.deltaX = event.clientX - gesture.current.startX;
    }
  };

  const finishPointer = (event: PointerEvent<HTMLAnchorElement>) => {
    const current = gesture.current;
    gesture.current = null;
    setPointerActive(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (current && itemCount > 1 && Math.abs(current.deltaX) >= 40) {
      suppressClick.current = true;
      moveBy(current.deltaX < 0 ? 1 : -1);
    }
  };

  const price = displayPrice(item);
  const secondary = item.subtitle || item.brandLabel;
  const accessibleLabel = [
    `Promotion: ${item.title}`,
    price,
    secondary,
    itemCount > 1 ? `Item ${activeIndex + 1} of ${itemCount}` : undefined,
    'Opens in a new tab',
  ]
    .filter(Boolean)
    .join('. ');

  return (
    <div
      className={`rs-promo-banner rs-promo-banner--${placement}`}
      style={style}
    >
      <a
        className="rs-promo-banner__link"
        href={item.destinationUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={accessibleLabel}
        onFocus={() => setHasFocus(true)}
        onBlur={() => setHasFocus(false)}
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishPointer}
        onPointerCancel={finishPointer}
        onClick={(event) => {
          if (suppressClick.current) {
            event.preventDefault();
            suppressClick.current = false;
          }
        }}
      >
        <span key={item.id} className="rs-promo-banner__inner">
          {item.imageUrl ? (
            <img
              className="rs-promo-banner__image"
              src={item.imageUrl}
              alt=""
              draggable={false}
              referrerPolicy="no-referrer"
            />
          ) : null}

          <span className="rs-promo-banner__copy">
            <span className="rs-promo-banner__headline">
              <strong>{item.title}</strong>
              {price ? <span>{price}</span> : null}
            </span>
            {secondary ? (
              <span className="rs-promo-banner__secondary">{secondary}</span>
            ) : null}
          </span>

          <span className="rs-promo-banner__external" aria-hidden="true">
            ↗
          </span>
        </span>
      </a>
    </div>
  );
}
