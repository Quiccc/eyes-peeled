import { CameraView } from 'expo-camera';
import type { RefObject } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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
      <SafeAreaView style={styles.overlay} pointerEvents="box-none">
        <View style={styles.top}>
          <CloseButton variant="overlay" onPress={onClose} />
          <View style={[styles.badge, { backgroundColor: pill.bg, borderColor: pill.main }]}>
            <ThemedText type="smallBold" style={{ color: pill.text }}>
              FIND
            </ThemedText>
            <ThemedText style={[styles.badgeWord, { color: theme.text }]}>{displayWord(word.word)}</ThemedText>
          </View>
          {/* Balances the close button so the badge stays centered. */}
          <View style={styles.spacer} />
        </View>
        <View style={styles.bottom}>
          <ThemedText type="small" style={styles.hint}>
            Fill the frame with the real {word.word}
          </ThemedText>
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
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 2,
    borderRadius: Radius.md,
    borderWidth: 2,
    borderBottomWidth: Edge.small,
  },
  badgeWord: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: 900,
    letterSpacing: 1,
  },
  bottom: {
    alignItems: 'center',
    gap: Spacing.three,
    paddingBottom: Spacing.four,
  },
  hint: {
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 4,
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
