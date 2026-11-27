import { CameraView } from 'expo-camera';
import { useState, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import type { DailyWord } from '@/api/types';
import { Chunky } from '@/components/chunky';
import { CLOSE_BUTTON_SIZE, CloseButton } from '@/components/close-button';
import { FlashIcon } from '@/components/hunt-icons';
import { GOLD, INK } from '@/components/illustrations/art-kit';
import { Spinner } from '@/components/spinner';
import { HuntCameraIcon } from '@/components/tab-icons';
import { ThemedText } from '@/components/themed-text';
import { difficultyColors, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useFormat } from '@/lib/format';

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

const SHUTTER = 84;
const SHUTTER_EDGE = 8;
const CORNER = 44;

/**
 * Full-screen viewfinder: close, the word card and the flash toggle on top; the frame corners in between;
 * the hint and the raised shutter in a tray at the bottom. Everything is laid out in a flex column, so the
 * frame fills whatever space a screen has, and no element changes size between "starting" and "ready".
 */
export function CameraCapture({ word, cameraRef, ready, onReady, onError, onCapture, onClose }: Props) {
  const fmt = useFormat();
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const c = difficultyColors(theme, word.difficulty);
  const [flash, setFlash] = useState(false);

  return (
    <View style={styles.root}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="back"
        mode="picture"
        flash={flash ? 'on' : 'off'}
        onCameraReady={onReady}
        onMountError={(e) => onError(e.message)}
      />
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.overlay} pointerEvents="box-none">
        <View style={styles.top} pointerEvents="box-none">
          <View style={styles.side}>
            <CloseButton variant="overlay" onPress={onClose} />
          </View>
          <View
            style={[styles.card, { backgroundColor: c.face, borderColor: c.main, borderBottomColor: c.edge }]}
            accessible
            accessibilityLabel={t('camera.cardA11y', {
              word: word.word,
              level: fmt.difficultyLabel(word.difficulty),
              count: word.maxPoints,
              found: word.foundCount,
            })}>
            <View style={[styles.cardPill, { backgroundColor: c.bg }]}>
              <ThemedText style={[styles.cardPillText, { color: c.text }]} maxFontSizeMultiplier={1.2} numberOfLines={1}>
                {t('camera.findLevel', { level: fmt.difficultyLabel(word.difficulty) }).toLocaleUpperCase(i18n.language)}
              </ThemedText>
            </View>
            <ThemedText
              style={styles.cardWord}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.6}
              maxFontSizeMultiplier={1.2}>
              {fmt.displayWord(word.word)}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} maxFontSizeMultiplier={1.2}>
              {t('camera.meta', { count: word.maxPoints, points: fmt.formatNumber(word.maxPoints), found: fmt.formatNumber(word.foundCount) })}
            </ThemedText>
          </View>
          <View style={styles.side}>
            <Pressable
              accessibilityRole="switch"
              accessibilityLabel={t('camera.flash')}
              accessibilityState={{ checked: flash }}
              hitSlop={8}
              onPress={() => setFlash((f) => !f)}
              style={({ pressed }) => [styles.flash, flash ? styles.flashOn : styles.flashOff, { opacity: pressed ? 0.7 : 1 }]}>
              <FlashIcon on={flash} size={20} />
            </Pressable>
          </View>
        </View>

        {/* The frame: corners at the edges of the space between the top row and the tray, a reticle in the middle. */}
        <View style={styles.viewfinder} pointerEvents="none" importantForAccessibility="no-hide-descendants">
          <View style={[styles.corner, styles.topLeft]} />
          <View style={[styles.corner, styles.topRight]} />
          <View style={[styles.corner, styles.bottomLeft]} />
          <View style={[styles.corner, styles.bottomRight]} />
          <View style={styles.reticleV} />
          <View style={styles.reticleH} />
        </View>

        <View style={[styles.tray, { paddingBottom: Math.max(40, insets.bottom + Spacing.three) }]}>
          {/* Two lines tall either way, so the shutter never moves when the hint changes. */}
          <View style={styles.hintBox}>
            <ThemedText style={styles.hint} numberOfLines={2} maxFontSizeMultiplier={1.1}>
              {ready ? t('camera.fillFrame', { word: word.word }) : t('camera.starting')}
            </ThemedText>
          </View>
          {ready ? (
            <Chunky
              color={theme.tint}
              edgeColor={theme.shutterEdge}
              radius={SHUTTER / 2}
              edge={SHUTTER_EDGE}
              onPress={onCapture}
              accessibilityLabel={t('camera.takePhoto')}
              style={styles.shutter}
              contentStyle={styles.shutterFace}>
              <HuntCameraIcon size={40} />
            </Chunky>
          ) : (
            <Chunky
              color="#8C847A"
              edgeColor="#45403A"
              radius={SHUTTER / 2}
              edge={SHUTTER_EDGE}
              accessible
              accessibilityRole="button"
              accessibilityLabel={t('camera.takePhoto')}
              accessibilityState={{ disabled: true, busy: true }}
              style={styles.shutter}
              contentStyle={styles.shutterFace}>
              <Spinner color="#FFFFFF" size={36} accessibilityLabel={t('camera.starting')} />
            </Chunky>
          )}
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
  },
  top: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
  },
  side: {
    width: CLOSE_BUTTON_SIZE,
    marginTop: 10,
  },
  card: {
    flexShrink: 1,
    maxWidth: 260,
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 9,
    borderRadius: 20,
    borderWidth: 2,
    borderBottomWidth: 5,
  },
  cardPill: {
    paddingHorizontal: 9,
    paddingVertical: 1,
    borderRadius: 999,
  },
  cardPillText: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: 900,
    letterSpacing: 0.8,
  },
  cardWord: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: 900,
    letterSpacing: 1,
  },
  flash: {
    width: CLOSE_BUTTON_SIZE,
    height: CLOSE_BUTTON_SIZE,
    borderRadius: CLOSE_BUTTON_SIZE / 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flashOff: {
    backgroundColor: 'rgba(20,16,12,0.6)',
    borderColor: 'rgba(255,255,255,0.18)',
  },
  flashOn: {
    backgroundColor: GOLD,
    borderColor: INK,
  },
  viewfinder: {
    flex: 1,
    marginHorizontal: 36,
    marginVertical: Spacing.four,
    minHeight: 120,
  },
  corner: {
    position: 'absolute',
    width: CORNER,
    height: CORNER,
    borderColor: '#FFFFFF',
  },
  topLeft: { top: 0, left: 0, borderTopWidth: 5, borderLeftWidth: 5, borderTopLeftRadius: 26 },
  topRight: { top: 0, right: 0, borderTopWidth: 5, borderRightWidth: 5, borderTopRightRadius: 26 },
  bottomLeft: { bottom: 0, left: 0, borderBottomWidth: 5, borderLeftWidth: 5, borderBottomLeftRadius: 26 },
  bottomRight: { bottom: 0, right: 0, borderBottomWidth: 5, borderRightWidth: 5, borderBottomRightRadius: 26 },
  reticleV: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: 2.4,
    height: 16,
    marginLeft: -1.2,
    marginTop: -8,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
  reticleH: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: 16,
    height: 2.4,
    marginLeft: -8,
    marginTop: -1.2,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
  tray: {
    alignItems: 'center',
    gap: 18,
    paddingTop: 18,
    paddingHorizontal: Spacing.four,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    backgroundColor: 'rgba(20,16,12,0.72)',
  },
  // Room for two lines (22px line height, up to 1.1× text size), so the shutter below never moves.
  hintBox: {
    alignSelf: 'stretch',
    minHeight: 50,
    justifyContent: 'center',
  },
  hint: {
    color: '#FFFFFF',
    textAlign: 'center',
  },
  shutter: {
    width: SHUTTER,
    borderRadius: SHUTTER / 2,
    boxShadow: '0 14px 18px rgba(0, 0, 0, 0.45)',
  },
  shutterFace: {
    height: SHUTTER,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: 'inset 0 3px 0 rgba(255, 255, 255, 0.35)',
  },
});
