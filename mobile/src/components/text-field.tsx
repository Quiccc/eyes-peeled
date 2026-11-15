import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { Icon, type IconName } from '@/components/icon';
import { Edge, FontFamily, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = Omit<TextInputProps, 'style' | 'placeholderTextColor'> & {
  /** Leading icon, e.g. "search". */
  icon?: IconName;
  /** regular: 48px search field. large: 56px chunky field for a single important value. */
  size?: 'regular' | 'large';
  /** Red border, e.g. after the server rejected the value. */
  invalid?: boolean;
};

/** The app's text input: a card-colored field with a 2px border. */
export function TextField({ icon, size = 'regular', invalid, ...input }: Props) {
  const theme = useTheme();
  const large = size === 'large';
  return (
    <View
      style={[
        styles.field,
        large ? styles.large : styles.regular,
        { backgroundColor: theme.backgroundElement, borderColor: invalid ? theme.hard : theme.border },
      ]}>
      {icon && <Icon name={icon} size={20} color={theme.textSecondary} />}
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
    height: 48,
    gap: Spacing.two + 2,
    paddingHorizontal: Spacing.three - 2,
  },
  large: {
    height: 56,
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderBottomWidth: Edge.small,
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
    fontSize: 20,
    fontWeight: 900,
  },
});
