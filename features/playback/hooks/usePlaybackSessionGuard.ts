import { useLayoutEffect, useMemo, useRef } from "react";

/** Each mounted source/engine generation owns its asynchronous callbacks. */
export function usePlaybackSessionGuard(key: string) {
  const generation = useMemo(() => ({}), [key]);
  const active = useRef<object | null>(null);
  useLayoutEffect(() => {
    active.current = generation;
    return () => {
      if (active.current === generation) active.current = null;
    };
  }, [generation]);
  return () => active.current === generation;
}
