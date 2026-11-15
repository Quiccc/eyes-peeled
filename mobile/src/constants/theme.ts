/**
 * Design tokens for the "chunky" Word Hunt look: warm grounds, an orange brand color,
 * and solid bottom edges on every raised surface. Light and dark share the same keys.
 */

import type { Difficulty } from '@/api/types';

export const Colors = {
  light: {
    text: '#2B2118',
    textSecondary: '#75644F',
    background: '#FFF6E5',
    /** Card / raised surface */
    backgroundElement: '#FFFFFF',
    /** Soft orange wash: selected tab, chips, photo placeholders */
    backgroundSelected: '#FFE4B8',
    border: '#E8D8BD',

    tint: '#FF8A00',
    tintEdge: '#D46A00',
    /** Text and icons on the orange brand color (dark, for contrast) */
    onTint: '#2B1600',

    ink: '#2B2118',
    inkEdge: '#000000',
    onInk: '#FFFFFF',

    success: '#2FB344',
    successEdge: '#176B27',
    successText: '#176B27',
    danger: '#F0524F',
    dangerText: '#A12624',

    easy: '#2FB344',
    easyBg: '#DDF5E1',
    easyText: '#176B27',
    medium: '#2D9CDB',
    mediumBg: '#DCEFFB',
    mediumText: '#155E8C',
    hard: '#F0524F',
    hardBg: '#FDE1E0',
    hardText: '#A12624',
    expert: '#9B5DE5',
    expertBg: '#EDE2FB',
    expertText: '#5F2FA8',

    gold: '#FFC83D',
    silver: '#C9D1D9',
    bronze: '#E0A072',
    onMedal: '#2B2118',
  },
  dark: {
    text: '#FFF3E0',
    textSecondary: '#C4B29B',
    background: '#1A1410',
    backgroundElement: '#2A2019',
    backgroundSelected: '#4A3418',
    border: '#453629',

    tint: '#FF9A1F',
    tintEdge: '#C46A00',
    onTint: '#2B1600',

    ink: '#FFF3E0',
    inkEdge: '#BBA88C',
    onInk: '#1A1410',

    success: '#3CCB55',
    successEdge: '#1F7A30',
    successText: '#8BE79A',
    danger: '#FF6B66',
    dangerText: '#FFAAA6',

    easy: '#3CCB55',
    easyBg: '#173D1E',
    easyText: '#8BE79A',
    medium: '#4DB4F0',
    mediumBg: '#12364D',
    mediumText: '#9AD6FA',
    hard: '#FF6B66',
    hardBg: '#4A1C1B',
    hardText: '#FFAAA6',
    expert: '#B583F5',
    expertBg: '#33214F',
    expertText: '#D5B8FB',

    gold: '#FFC83D',
    silver: '#C9D1D9',
    bronze: '#E0A072',
    onMedal: '#2B2118',
  },
} as const;

export type Theme = { [K in keyof typeof Colors.light]: string };
export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

/** The three shades of a difficulty: strong (borders, edges), soft background and readable text for pills. */
export function difficultyColors(theme: Theme, difficulty: Difficulty) {
  return {
    main: theme[difficulty],
    bg: theme[`${difficulty}Bg`],
    text: theme[`${difficulty}Text`],
  };
}

/** Nunito is embedded at build time by the expo-font config plugin (see app.json). */
export const FontFamily = 'Nunito';

export const Spacing = {
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = {
  sm: 12,
  md: 16,
  lg: 24,
  pill: 999,
} as const;

/** Height of the solid bottom edge under raised surfaces. */
export const Edge = {
  card: 6,
  button: 5,
  small: 4,
} as const;

/**
 * The custom tab bar sits in the layout below each tab screen (it doesn't float over content),
 * so screens need no extra bottom inset for it.
 */
export const BottomTabInset = 0;
