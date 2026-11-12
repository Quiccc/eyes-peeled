import { useEffect, useRef, useState } from 'react';

import { ThemedText, type ThemedTextProps } from '@/components/themed-text';
import { formatCountdown } from '@/lib/format';

type Props = Omit<ThemedTextProps, 'children'> & {
  /** ISO instant from the server — the device clock is only used to tick, never as the source of truth. */
  target: string;
  onExpire?: () => void;
};

export function Countdown({ target, onExpire, ...textProps }: Props) {
  const targetMs = new Date(target).getTime();
  const [now, setNow] = useState(() => Date.now());
  const firedFor = useRef<number | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const remaining = targetMs - now;

  useEffect(() => {
    if (remaining <= 0 && firedFor.current !== targetMs) {
      firedFor.current = targetMs;
      onExpire?.();
    }
  }, [remaining, targetMs, onExpire]);

  return <ThemedText {...textProps}>{formatCountdown(remaining)}</ThemedText>;
}
