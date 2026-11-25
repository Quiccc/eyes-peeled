import { useRef } from 'react';

/** How long after a press further presses are ignored, for handlers that return straight away (e.g. navigation). */
const COOLDOWN_MS = 500;

/**
 * Stops a fast double tap from running a press handler twice. `guard(onPress)` wraps a handler:
 * if it returns a promise, presses are ignored until it settles; otherwise for a short cooldown.
 * Every handler wrapped by the same guard shares one lock, so two buttons in a group can't both fire.
 * A ref, not state, holds the lock, so it is in place before the second tap, without waiting for a re-render.
 */
export function usePressGuard() {
  const locked = useRef(false);

  // An arrow function on purpose: Babel drops TypeScript overloads of a function declared inside a function.
  const guard = <A extends unknown[]>(onPress: ((...args: A) => unknown) | null | undefined) => {
    if (!onPress) return undefined;
    return (...args: A) => {
      if (locked.current) return;
      locked.current = true;
      const unlock = () => {
        locked.current = false;
      };
      let result: unknown;
      try {
        result = onPress(...args);
      } catch (e) {
        unlock();
        throw e;
      }
      if (result instanceof Promise) result.then(unlock, unlock);
      else setTimeout(unlock, COOLDOWN_MS);
    };
  };

  return guard;
}
