import { useRef, useState } from 'react';
import { Alert } from 'react-native';

import { errorMessage } from '@/lib/format';

type RunOptions = {
  /** Alert title when the action fails. */
  errorTitle: string;
  /** Failures to swallow silently, e.g. the user cancelling a sign-in sheet. */
  ignore?: (e: unknown) => boolean;
};

/**
 * Runs one async action at a time from a button: tracks which one is busy (for spinners and
 * disabling the others) and shows failures in an alert.
 */
export function useAsyncAction<K extends string = 'run'>() {
  const [busy, setBusy] = useState<K | null>(null);
  // `busy` only updates on the next render; this ref blocks a second tap that lands before then.
  const running = useRef(false);

  const run = async (key: K, action: () => Promise<unknown>, { errorTitle, ignore }: RunOptions) => {
    if (running.current) return;
    running.current = true;
    setBusy(key);
    try {
      await action();
    } catch (e) {
      if (!ignore?.(e)) Alert.alert(errorTitle, errorMessage(e));
    } finally {
      running.current = false;
      setBusy(null);
    }
  };

  return { busy, run };
}
