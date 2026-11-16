import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { Icon, type IconName } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { FontFamily, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = Omit<TextInputProps, 'style' | 'placeholderTextColor'> & {
  /** Leading icon, e.g. "search". */
  icon?: IconName;
  /** Fixed text before the value, e.g. "@" for a username. */
  prefix?: string;
  /** regular: 48px search field. large: 64px chunky field for a single important value. */
  size?: 'regular' | 'large';
  /** Orange border: the field is the screen's one call to fill in. */
  accent?: boolean;
  /** Red border, e.g. after the server rejected the value. Wins over `accent`. */
  invalid?: boolean;
};

/** The app's text input: a card-colored field with a 2px border. */
export function TextField({ icon, prefix, size = 'regular', accent, invalid, ...input }: Props) {
  const theme = useTheme();
  const large = size === 'large';
  const borderColor = invalid ? theme.hard : accent ? theme.tint : theme.border;
  return (
    <View
      style={[
        styles.field,
        large ? styles.large : styles.regular,
        prefix ? styles.withPrefix : null,
        { backgroundColor: theme.backgroundElement, borderColor },
      ]}>
      {icon && <Icon name={icon} size={20} color={theme.textSecondary} />}
      {prefix ? (
        <ThemedText
          themeColor="textSecondary"
          style={large ? styles.inputLarge : styles.inputRegular}
          importantForAccessibility="no"
          accessibilityElementsHidden>
          {prefix}
        </ThemedText>
      ) : null}
      <TextInput
        placeholderTextColor={theme.textSecondary}
        style={[styles.input, large ? styles.inputLarge : styles.inputRegular, { color: theme.text }]}
        {...input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.md,
    borderWidth: 2,
  },
  regular: {
    height: 52,
    gap: Spacing.two + 2,
    paddingHorizontal: Spacing.three - 2,
  },
  large: {
    height: 64,
    gap: Spacing.two,
    paddingHorizontal: 18,
    borderRadius: 18,
    borderBottomWidth: 5,
  },
  withPrefix: {
    gap: Spacing.one,
  },
  input: {
    flex: 1,
    minWidth: 0,
    alignSelf: 'stretch',
    fontFamily: FontFamily,
  },
  inputRegular: {
    fontSize: 16,
    fontWeight: 700,
  },
  inputLarge: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: 900,
  },
});
