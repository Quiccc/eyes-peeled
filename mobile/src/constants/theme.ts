/**
 * Design tokens for the "chunky" Eyes Peeled look: warm grounds, an orange brand color,
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
    /** Text and icons on a solid green (success) fill */
    onSuccess: '#0B3313',
    danger: '#F0524F',
    dangerText: '#A12624',

    /** Today's scoreboard card: a warm orange-tinted face with a brand-orange edge */
    scoreFace: '#FFF1DC',
    scoreEdge: '#FF8A00',
    scoreDivider: '#FFD49A',
    scoreNumber: '#C25F00',
    /** Outline of the streak pill */
    streakEdge: '#FF8A00',
    /** Label and icon of the selected tab */
    tabSelected: '#A84F00',
    /** The camera shutter's bottom edge: darker than tintEdge so the big button reads as raised. */
    shutterEdge: '#A84F00',

    easy: '#2FB344',
    easyBg: '#DDF5E1',
    easyText: '#176B27',
    /** Faint tint for a whole card face in this difficulty */
    easyFace: '#F3FBF4',
    /** Chunky bottom edge under a solid fill in this difficulty (action buttons) */
    easyEdge: '#1E8A30',
    /** Label and icon on a solid fill in this difficulty */
    easyOn: '#0B3313',
    medium: '#2D9CDB',
    mediumBg: '#DCEFFB',
    mediumText: '#155E8C',
    mediumFace: '#F1F8FD',
    mediumEdge: '#1B6E9E',
    mediumOn: '#082235',
    hard: '#F0524F',
    hardBg: '#FDE1E0',
    hardText: '#A12624',
    hardFace: '#FEF4F3',
    hardEdge: '#B5302D',
    hardOn: '#3A0B0A',
    expert: '#9B5DE5',
    expertBg: '#EDE2FB',
    expertText: '#5F2FA8',
    expertFace: '#F8F2FE',
    /** Chunky bottom edge and text on a solid purple (Premium) fill */
    expertEdge: '#6F35B8',
    onExpert: '#FFFFFF',
    /** Dark label on a purple action button (the Premium badge keeps white via onExpert) */
    expertOn: '#1F0F33',

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
    onSuccess: '#0B2A11',
    danger: '#FF6B66',
    dangerText: '#FFAAA6',

    scoreFace: '#3A2412',
    scoreEdge: '#C46A00',
    scoreDivider: '#5E3A16',
    scoreNumber: '#FF9A1F',
    streakEdge: '#C46A00',
    tabSelected: '#FF9A1F',
    shutterEdge: '#9A4E00',

    easy: '#3CCB55',
    easyBg: '#173D1E',
    easyText: '#8BE79A',
    easyFace: '#1F2B1D',
    easyEdge: '#1F7A30',
    easyOn: '#0B3313',
    medium: '#4DB4F0',
    mediumBg: '#12364D',
    mediumText: '#9AD6FA',
    mediumFace: '#1B2833',
    mediumEdge: '#1F6E9E',
    mediumOn: '#082235',
    hard: '#FF6B66',
    hardBg: '#4A1C1B',
    hardText: '#FFAAA6',
    hardFace: '#331F1D',
    hardEdge: '#B23A36',
    hardOn: '#3A0B0A',
    expert: '#B583F5',
    expertBg: '#33214F',
    expertText: '#D5B8FB',
    expertFace: '#2A2238',
    expertEdge: '#7E4FC2',
    onExpert: '#1F0F33',
    expertOn: '#1F0F33',

    gold: '#FFC83D',
    silver: '#C9D1D9',
    bronze: '#E0A072',
    onMedal: '#2B2118',
  },
} as const;

type Theme = { [K in keyof typeof Colors.light]: string };
export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

/**
 * The shades of a difficulty: strong (borders, edges), soft background and readable text for pills,
 * and a faint face tint for a whole card.
 */
export function difficultyColors(theme: Theme, difficulty: Difficulty) {
  return {
    main: theme[difficulty],
    bg: theme[`${difficulty}Bg`],
    text: theme[`${difficulty}Text`],
    /** Darker bottom edge and readable label for a solid fill in this difficulty (action buttons). */
    edge: theme[`${difficulty}Edge`],
    on: theme[`${difficulty}On`],
    face: theme[`${difficulty}Face`],
  };
}

/** Nunito (400, 700, 800, 900) is embedded at build time by the expo-font config plugin in app.json. */
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
