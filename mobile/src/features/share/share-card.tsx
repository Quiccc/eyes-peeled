import { Image } from 'expo-image';
import type { ComponentRef, Ref } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { DIFFICULTY_LABEL, displayWord, ordinal } from '@/lib/format';

import type { ShareFind } from './types';

/** Logical size; captured at 3x width (1080px) — a 4:5 image that suits Instagram and most feeds. */
export const SHARE_CARD_WIDTH = 360;
export const SHARE_CARD_HEIGHT = 450;

/** Fixed brand palette — the shared image looks the same whether the app is in light or dark mode. */
const BRAND = {
  panel: '#0F1115',
  text: '#FFFFFF',
  muted: '#B0B4BA',
  tint: Colors.light.tint,
};

type Props = {
  find: ShareFind;
  onImageLoad?: () => void;
  ref?: Ref<ComponentRef<typeof View>>;
};

export function ShareCard({ find, onImageLoad, ref }: Props) {
  const accent = Colors.light[find.difficulty];

  return (
    <View ref={ref} collapsable={false} style={styles.card}>
      <Image
        source={find.imageUri}
        style={styles.photo}
        contentFit="cover"
        transition={0}
        onLoad={onImageLoad}
      />
      <View style={styles.panel}>
        <View style={styles.row}>
          <View style={[styles.pill, { backgroundColor: accent }]}>
            <Text style={styles.pillText}>{DIFFICULTY_LABEL[find.difficulty].toUpperCase()}</Text>
          </View>
          <Text style={styles.points}>+{find.points} pts</Text>
        </View>
        <Text style={styles.word} numberOfLines={1} adjustsFontSizeToFit>
          {displayWord(find.word)}
        </Text>
        <View style={styles.row}>
          <Text style={styles.muted}>{find.rank ? `${ordinal(find.rank)} hunter to find it today` : 'Found it today'}</Text>
          <Text style={styles.brand}>🔍 Word Hunt</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: SHARE_CARD_WIDTH,
    height: SHARE_CARD_HEIGHT,
    backgroundColor: BRAND.panel,
    borderRadius: 20,
    overflow: 'hidden',
  },
  photo: {
    flex: 1,
  },
  panel: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 999,
  },
  pillText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: 1,
  },
  points: {
    color: BRAND.text,
    fontSize: 16,
    fontWeight: 800,
  },
  word: {
    color: BRAND.text,
    fontSize: 32,
    lineHeight: 38,
    fontWeight: 900,
    letterSpacing: 1.5,
  },
  muted: {
    color: BRAND.muted,
    fontSize: 12,
    fontWeight: 500,
  },
  brand: {
    color: BRAND.tint,
    fontSize: 13,
    fontWeight: 800,
  },
});
