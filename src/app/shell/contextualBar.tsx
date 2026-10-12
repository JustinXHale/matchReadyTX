import {
  createContext,
  useContext,
  useLayoutEffect,
  type Dispatch,
  type SetStateAction,
} from 'react';
import { useAppBack, type BackNav } from '@/nav/backNav';

export type ContextualBarSpec = {
  label: string;
  onActivate: () => void;
};

export const ContextualBarContext = createContext<
  Dispatch<SetStateAction<ContextualBarSpec | null>> | null
>(null);

/** Registers route-specific navigation in the non-scrolling app-shell subheader. */
export function useContextualBackBar(
  label: string,
  onActivate: () => void,
): void {
  const setContextualBar = useContext(ContextualBarContext);

  useLayoutEffect(() => {
    if (!setContextualBar) return;
    const spec: ContextualBarSpec = { label, onActivate };
    setContextualBar(spec);
    return () => {
      setContextualBar((current) => (current === spec ? null : current));
    };
  }, [label, onActivate, setContextualBar]);
}

/** Route back behavior plus the shared, non-scrolling shell presentation. */
export function useContextualAppBack(fallback: BackNav) {
  const appBack = useAppBack(fallback);
  useContextualBackBar(appBack.backLabel, appBack.goBack);
  return appBack;
}
