import { useLayoutEffect, useRef, type RefObject } from 'react';

function scrollableAncestor(from: HTMLElement): HTMLElement | null {
  let node: HTMLElement | null = from.parentElement;
  while (node) {
    const overflowY = getComputedStyle(node).overflowY;
    if (
      (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') &&
      node.scrollHeight > node.clientHeight + 1
    ) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

/** Align `el` to the top of its scrollport (section titles, not page chrome). */
export function scrollReportSectionIntoView(el: HTMLElement | null): void {
  const active = document.activeElement;
  if (active instanceof HTMLElement && active !== document.body) {
    active.blur();
  }
  if (!el) return;

  const scroller = scrollableAncestor(el);
  if (!scroller) {
    el.scrollIntoView({ block: 'start', behavior: 'auto' });
    return;
  }

  const elTop = el.getBoundingClientRect().top;
  const scrollerTop = scroller.getBoundingClientRect().top;
  const margin = Number.parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
  const back = el
    .closest('.rs-cmo-report, .rs-perf-report, .rs-stack')
    ?.querySelector<HTMLElement>('.rs-detail__back');
  const stickyH =
    back && getComputedStyle(back).position === 'sticky'
      ? back.getBoundingClientRect().height
      : 0;
  scroller.scrollTop = Math.max(
    0,
    scroller.scrollTop + (elTop - scrollerTop) - margin - stickyH,
  );
}

/** After the first paint, scroll to the section titles when `pageKey` changes. */
export function useScrollReportToTopOnChange(
  pageKey: string | number,
): RefObject<HTMLElement | null> {
  const ref = useRef<HTMLElement>(null);
  const skipFirst = useRef(true);

  useLayoutEffect(() => {
    if (skipFirst.current) {
      skipFirst.current = false;
      return;
    }
    scrollReportSectionIntoView(ref.current);
  }, [pageKey]);

  return ref;
}
