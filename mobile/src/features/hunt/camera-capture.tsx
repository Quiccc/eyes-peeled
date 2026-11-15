import { CameraView } from 'expo-camera';
import type { RefObject } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import type { DailyWord } from '@/api/types';
import { CLOSE_BUTTON_SIZE, CloseButton } from '@/components/close-button';
import { ThemedText } from '@/components/themed-text';
import { difficultyColors, Edge, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { displayWord } from '@/lib/format';

type Props = {
  word: DailyWord;
  cameraRef: RefObject<CameraView | null>;
  /** The shutter stays disabled until the camera reports it's ready. */
  ready: boolean;
  onReady: () => void;
  onError: (message: string) => void;
  onCapture: () => void;
  onClose: () => void;
};

/** Full-screen viewfinder: close button, the word to find, and the shutter. */
export function CameraCapture({ word, cameraRef, ready, onReady, onError, onCapture, onClose }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const pill = difficultyColors(theme, word.difficulty);

  return (
    <View style={styles.root}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="back"
        mode="picture"
        onCameraReady={onReady}
        onMountError={(e) => onError(e.message)}
      />
      {/* Viewfinder corners. */}
      <View style={styles.viewfinder} pointerEvents="none" importantForAccessibility="no-hide-descendants">
        <View style={[styles.corner, styles.topLeft]} />
        <View style={[styles.corner, styles.topRight]} />
        <View style={[styles.corner, styles.bottomLeft]} />
        <View style={[styles.corner, styles.bottomRight]} />
      </View>
      <SafeAreaView edges={['top']} style={styles.overlay} pointerEvents="box-none">
        <View style={styles.top}>
          <CloseButton variant="overlay" onPress={onClose} />
          <View style={[styles.badge, { backgroundColor: pill.bg, borderColor: pill.main }]}>
            <ThemedText type="smallBold" style={[styles.badgeLabel, { color: pill.text }]}>
              FIND
            </ThemedText>
            <ThemedText style={[styles.badgeWord, { color: theme.text }]}>{displayWord(word.word)}</ThemedText>
          </View>
          {/* Balances the close button so the badge stays centered. */}
          <View style={styles.spacer} />
        </View>
        <View style={[styles.bottom, { paddingBottom: Math.max(40, insets.bottom + Spacing.two) }]}>
          <View style={styles.hintPill}>
            <ThemedText type="small" style={styles.hint}>
              Fill the frame with the real {word.word}
            </ThemedText>
          </View>
          <Pressable
            accessibilityLabel="Take photo"
            onPress={onCapture}
            disabled={!ready}
            style={({ pressed }) => [styles.shutter, { opacity: !ready ? 0.4 : pressed ? 0.7 : 1 }]}>
            <View style={styles.shutterInner} />
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  overlay: {
    flex: 1,
    justifyContent: 'space-between',
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
  },
  spacer: {
    width: CLOSE_BUTTON_SIZE,
    height: CLOSE_BUTTON_SIZE,
  },
  badge: {
    flexShrink: 1,
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: Spacing.one + 2,
    borderRadius: 18,
    borderWidth: 2,
    borderBottomWidth: Edge.button,
  },
  badgeLabel: {
    letterSpacing: 1,
  },
  badgeWord: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: 900,
    letterSpacing: 1,
  },
  // The design's frame on a 390×844 screen: 40px from the sides, 200 from the top, 230 from the bottom.
  viewfinder: {
    position: 'absolute',
    left: 40,
    right: 40,
    top: '23.7%',
    bottom: '27.3%',
  },
  corner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: '#fff',
  },
  topLeft: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 24 },
  topRight: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 24 },
  bottomLeft: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 24 },
  bottomRight: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 24 },
  bottom: {
    alignItems: 'center',
    gap: Spacing.three,
  },
  hintPill: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  hint: {
    color: '#fff',
  },
  shutter: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 5,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff',
  },
});
