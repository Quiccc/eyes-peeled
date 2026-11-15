import { StyleSheet, View } from 'react-native';

type Props = {
  /** Steps done and total, e.g. words found out of today's words. */
  value: number;
  max: number;
  trackColor: string;
  fillColor: string;
  accessibilityLabel: string;
};

/** A thin rounded progress bar. */
export function ProgressBar({ value, max, trackColor, fillColor, accessibilityLabel }: Props) {
  const progress = max > 0 ? Math.min(1, value / max) : 0;
  return (
    <View
      style={[styles.track, { backgroundColor: trackColor }]}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max, now: value }}>
      <View style={[styles.fill, { width: `${progress * 100}%`, backgroundColor: fillColor }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 12,
    borderRadius: 999,
    overflow: 'hidden',
  },
  fill: {
    height: 12,
    borderRadius: 999,
  },
});
