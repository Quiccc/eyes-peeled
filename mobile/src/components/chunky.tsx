import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { Edge, Radius } from '@/constants/theme';
import { tap } from '@/lib/haptics';

const OUTLINE = 2;

type Props = Omit<PressableProps, 'style' | 'children'> & {
  /** Face color. */
  color: string;
  /** Color of the solid bottom edge (and of the face outline when `outlined`). */
  edgeColor: string;
  /** Draw a 2px outline in the edge color around the face (cards). */
  outlined?: boolean;
  radius?: number;
  /**
   * Height of the solid bottom band in px. With `outlined`, the 2px outline counts toward it,
   * like CSS `border: 2px; border-bottom-width: 6px`.
   */
  edge?: number;
  /** Outer box: margins, flex, width. */
  style?: StyleProp<ViewStyle>;
  /** The face: padding and inner layout. */
  contentStyle?: StyleProp<ViewStyle>;
  children?: ReactNode;
};

/**
 * The app's raised surface: a face sitting on a solid bottom edge.
 * With `onPress` it is a button that sinks onto its edge while pressed; without, a static card.
 */
export function Chunky({
  color,
  edgeColor,
  outlined,
  radius = Radius.md,
  edge = Edge.button,
  style,
  contentStyle,
  children,
  onPress,
  onPressIn,
  onPressOut,
  disabled,
  ...rest
}: Props) {
  /** How far the face sits above the edge layer (and sinks when pressed). */
  const drop = outlined ? Math.max(0, edge - OUTLINE) : edge;
  const pressed = useSharedValue(0);
  const faceMotion = useAnimatedStyle(() => ({ transform: [{ translateY: pressed.value * drop }] }));

  const edgeLayer = (
    <View
      style={[styles.edge, { top: drop, borderRadius: radius, backgroundColor: edgeColor }]}
      importantForAccessibility="no"
    />
  );
  const faceStyle = [
    styles.face,
    { backgroundColor: color, borderRadius: radius, marginBottom: drop },
    outlined && { borderWidth: OUTLINE, borderColor: edgeColor },
    contentStyle,
  ];

  if (!onPress) {
    return (
      <View style={style} {...(rest as object)}>
        {edgeLayer}
        <View style={faceStyle}>{children}</View>
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      onPressIn={(e) => {
        pressed.value = withTiming(1, { duration: 70 });
        tap();
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        pressed.value = withSpring(0, { damping: 14, stiffness: 320 });
        onPressOut?.(e);
      }}
      style={[style, disabled && styles.disabled]}
      {...rest}>
      {edgeLayer}
      <Animated.View style={[faceStyle, faceMotion]}>{children}</Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  edge: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  face: {
    flexGrow: 1,
  },
  disabled: {
    opacity: 0.5,
  },
});
