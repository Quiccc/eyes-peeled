import { useEffect, useState } from 'react';
import { useReducedMotion } from 'react-native-reanimated';

import { ThemedText, type ThemedTextProps } from '@/components/themed-text';

type CountUpProps = Omit<ThemedTextProps, 'children'> & {
  value: number;
  prefix?: string;
  suffix?: string;
  /** Wait this long before counting (ms). */
  delay?: number;
  /** How long the count takes (ms). */
  duration?: number;
  /** Turns the number into text, e.g. formatNumber for "1,240". */
  format?: (n: number) => string;
};

/** Counts from 0 to `value` (0.7s by default). Shows the final value straight away under Reduce Motion. */
export function CountUp({
  value,
  prefix = '',
  suffix = '',
  delay = 0,
  duration = 700,
  format = String,
  ...textProps
}: CountUpProps) {
  const reduced = useReducedMotion();
  const [counted, setShown] = useState(0);
  const shown = reduced ? value : counted;

  useEffect(() => {
    if (reduced) return;
    const started = Date.now() + delay;
    let frame = 0;
    const tick = () => {
      const p = Math.min(1, Math.max(0, (Date.now() - started) / duration));
      setShown(Math.round(value * (1 - (1 - p) * (1 - p))));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, reduced, delay, duration]);

  return (
    <ThemedText accessibilityLabel={`${prefix}${format(value)}${suffix}`} {...textProps}>
      {prefix}
      {format(shown)}
      {suffix}
    </ThemedText>
  );
}
