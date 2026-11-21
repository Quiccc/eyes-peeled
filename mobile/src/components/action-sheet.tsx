import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Icon, type IconName } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Edge, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { tap } from '@/lib/haptics';

export type ActionSheetItem = {
  label: string;
  icon: IconName;
  /** Red label and icon for actions that cut someone off (block, report). */
  destructive?: boolean;
  onPress: () => void;
};

type Props = {
  visible: boolean;
  /** Read out as the menu's name, e.g. "Options for alex". */
  title: string;
  items: ActionSheetItem[];
  onClose: () => void;
};

/**
 * A chunky bottom sheet of actions with a Cancel button, over a dimmed screen.
 * Used where a menu needs more than the three buttons an Android alert can show.
 */
export function ActionSheet({ visible, title, items, onClose }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityRole="button"
          accessibilityLabel="Close menu"
          onPress={onClose}
        />
        <View
          accessibilityRole="menu"
          accessibilityLabel={title}
          style={[
            styles.sheet,
            {
              marginBottom: Math.max(insets.bottom, Spacing.two),
              backgroundColor: theme.backgroundElement,
              borderColor: theme.border,
            },
          ]}>
          <View style={[styles.grabber, { backgroundColor: theme.border }]} />
          {items.map((item) => {
            const color = item.destructive ? theme.dangerText : theme.text;
            return (
              <Pressable
                key={item.label}
                accessibilityRole="menuitem"
                onPress={() => {
                  tap();
                  onClose();
                  item.onPress();
                }}
                style={({ pressed }) => [styles.item, pressed && { backgroundColor: theme.backgroundSelected }]}>
                <Icon name={item.icon} size={22} color={color} />
                <ThemedText style={[styles.label, { color }]}>{item.label}</ThemedText>
              </Pressable>
            );
          })}
          <Button title="Cancel" variant="secondary" onPress={onClose} style={styles.cancel} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(26, 20, 16, 0.45)',
  },
  sheet: {
    marginHorizontal: Spacing.two,
    padding: Spacing.two,
    borderRadius: 28,
    borderWidth: 2,
    borderBottomWidth: Edge.card,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    marginTop: Spacing.one,
    marginBottom: Spacing.two,
  },
  item: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + 4,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.md,
  },
  label: {
    fontWeight: 900,
  },
  cancel: {
    marginTop: Spacing.two,
  },
});
