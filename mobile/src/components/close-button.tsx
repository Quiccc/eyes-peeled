import { Pressable, StyleSheet } from 'react-native';

import { Icon } from '@/components/icon';
import { Edge } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  onPress: () => void;
  /** surface: a small card (on screens). overlay: white X on a dark glass square (on the camera). */
  variant?: 'surface' | 'overlay';
};

export const CLOSE_BUTTON_SIZE = 44;

/** The 44×44 "close" square in the top corner of full-screen modals. */
export function CloseButton({ onPress, variant = 'surface' }: Props) {
  const theme = useTheme();
  const overlay = variant === 'overlay';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Close"
      hitSlop={overlay ? 8 : undefined}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        overlay
          ? styles.overlay
          : [styles.surface, { backgroundColor: theme.backgroundElement, borderColor: theme.border, opacity: pressed ? 0.7 : 1 }],
      ]}>
      <Icon name="close" size={20} color={overlay ? '#FFFFFF' : theme.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: CLOSE_BUTTON_SIZE,
    height: CLOSE_BUTTON_SIZE,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  surface: {
    borderWidth: 2,
    borderBottomWidth: Edge.small,
  },
  overlay: {
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
});
