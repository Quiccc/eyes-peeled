import { Image } from 'expo-image';
import type { ComponentRef, Ref } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/icon';
import { Colors, FontFamily } from '@/constants/theme';
import { DIFFICULTY_LABEL, displayWord, ordinal } from '@/lib/format';

import type { ShareFind } from './types';

/** Logical size, 4:5 (suits Instagram and most feeds). Captured at SHARE_CAPTURE_WIDTH px wide. */
export const SHARE_CARD_WIDTH = 324;
export const SHARE_CARD_HEIGHT = 405;
export const SHARE_CAPTURE_WIDTH = 1080;

/** The light palette, fixed: the shared image looks the same whether the app is in light or dark mode. */
const C = Colors.light;

type Props = {
  find: ShareFind;
  onImageLoad?: () => void;
  ref?: Ref<ComponentRef<typeof View>>;
};

/** The image people share: a chunky white card edged in the word's difficulty color, with the photo inset. */
export function ShareCard({ find, onImageLoad, ref }: Props) {
  const d = find.difficulty;

  return (
    <View ref={ref} collapsable={false} style={[styles.card, { borderColor: C[d] }]}>
      <View style={styles.photoBox}>
        <Image source={find.imageUri} style={styles.photo} contentFit="cover" transition={0} onLoad={onImageLoad} />
      </View>
      <View style={styles.info}>
        <View style={styles.row}>
          <View style={[styles.pill, { backgroundColor: C[`${d}Bg`] }]}>
            <Text style={[styles.text, styles.pillText, { color: C[`${d}Text`] }]}>{DIFFICULTY_LABEL[d].toUpperCase()}</Text>
          </View>
          <Text style={[styles.text, styles.points]}>+{find.points} pts</Text>
        </View>
        <Text style={[styles.text, styles.word]} numberOfLines={1} adjustsFontSizeToFit>
          {displayWord(find.word)}
        </Text>
        <View style={styles.row}>
          <Text style={[styles.text, styles.muted]} numberOfLines={1}>
            {find.rank ? `${ordinal(find.rank)} hunter to find it today` : 'Found it today'}
          </Text>
          <View style={styles.brand}>
            <View style={styles.brandTile}>
              <View style={styles.brandFace}>
                <Icon name="search" size={14} color={C.onTint} />
              </View>
            </View>
            <Text style={[styles.text, styles.brandText]}>Word Hunt</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: SHARE_CARD_WIDTH,
    height: SHARE_CARD_HEIGHT,
    backgroundColor: C.backgroundElement,
    borderRadius: 24,
    borderWidth: 2,
    borderBottomWidth: 6,
    padding: 10,
    gap: 10,
  },
  photoBox: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: C.backgroundSelected,
  },
  photo: {
    flex: 1,
  },
  info: {
    paddingHorizontal: 6,
    paddingBottom: 2,
    gap: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  text: {
    fontFamily: FontFamily,
    color: C.text,
    fontWeight: 700,
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 999,
  },
  pillText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: 900,
    letterSpacing: 0.5,
  },
  points: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: 900,
    fontVariant: ['tabular-nums'],
    color: C.successText,
  },
  word: {
    fontSize: 32,
    lineHeight: 36,
    fontWeight: 900,
    letterSpacing: 1,
  },
  muted: {
    flexShrink: 1,
    fontSize: 13,
    lineHeight: 18,
    color: C.textSecondary,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  /** 24px orange tile on a 2px darker edge, tilted like the app icon. */
  brandTile: {
    width: 24,
    height: 26,
    borderRadius: 8,
    backgroundColor: C.tintEdge,
    transform: [{ rotate: '-6deg' }],
  },
  brandFace: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: C.tint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: 900,
  },
});
