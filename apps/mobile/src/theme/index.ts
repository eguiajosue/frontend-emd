import { Platform, type TextStyle, type ViewStyle } from 'react-native';

/** Paleta del logo EMD (ver apps/web/src/app/globals.css). */
export const colors = {
  navy: '#1B1B3A',
  navyLight: '#2A2A55',
  navyDark: '#12122A',
  magenta: '#E0399A',
  magentaStrong: '#C41E80', // texto blanco sobre magenta, AA
  magentaSoft: '#FCE7F3',
  cyan: '#7DD3E8',
  cyanSoft: '#E3F6FB',
  lime: '#C6D645',
  limeSoft: '#F4F8D6',

  bg: '#F5F5FA',
  surface: '#FFFFFF',
  border: '#E3E3EE',
  text: '#1B1B3A',
  textMuted: '#5B5B7A',
  textOnNavy: '#FFFFFF',
  textOnNavyMuted: '#B8B8D6',
  danger: '#C62828',
  dangerSoft: '#FDECEC',
  success: '#0F8A5F',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radii = { sm: 8, md: 12, lg: 16, xl: 24, pill: 999 } as const;

export const typography = {
  display: { fontSize: 28, lineHeight: 34, fontWeight: '800', letterSpacing: -0.3 },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700' },
  heading: { fontSize: 17, lineHeight: 24, fontWeight: '700' },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' },
  bodyStrong: { fontSize: 16, lineHeight: 24, fontWeight: '600' },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '500' },
  overline: { fontSize: 12, lineHeight: 16, fontWeight: '700', letterSpacing: 0.8 },
} satisfies Record<string, TextStyle>;

export const shadows = {
  card: Platform.select<ViewStyle>({
    ios: {
      shadowColor: '#1B1B3A',
      shadowOpacity: 0.08,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
    },
    default: { elevation: 3 },
  }) as ViewStyle,
} as const;

/** Duraciones de movimiento (ms): rápidas, 150-250. */
export const motion = { fast: 150, base: 200, slow: 250, stagger: 40 } as const;

/** Color de estado por tono semántico (mismo mapeo que la Web). `fg` cumple contraste AA sobre `bg`. */
export const toneColors: Record<string, { bg: string; fg: string; dot: string }> = {
  neutral: { bg: '#ECEEF3', fg: '#3D4457', dot: '#94A3B8' },
  info: { bg: '#E0F4FB', fg: '#075985', dot: '#0EA5E9' },
  warning: { bg: '#FEF3C7', fg: '#8A4B05', dot: '#F59E0B' },
  progress: { bg: '#EDE9FE', fg: '#5B21B6', dot: '#8B5CF6' },
  success: { bg: '#D9F5E8', fg: '#0B6B49', dot: '#10B981' },
  done: { bg: '#E0E7FF', fg: '#3730A3', dot: '#6366F1' },
  danger: { bg: '#FFEDD5', fg: '#9A3412', dot: '#F97316' },
  critical: { bg: '#FEE2E2', fg: '#991B1B', dot: '#EF4444' },
};

export function toneStyle(tone: string) {
  return toneColors[tone] ?? toneColors.neutral;
}
