// Version 3 — Modern dark-first design system
// Primary: Electric Violet | Accent: Neon Cyan | Secondary: Hot Pink

export const darkTheme = {
  // Backgrounds
  background:     '#06060F',
  surface:        '#0D0D1E',
  surfaceAlt:     '#13132A',
  card:           'rgba(255,255,255,0.04)',
  cardHighlight:  'rgba(124,58,237,0.12)',

  // Brand
  primary:        '#7C3AED',
  primaryLight:   'rgba(124,58,237,0.18)',
  primaryGlow:    'rgba(124,58,237,0.35)',

  accent:         '#22D3EE',
  accentLight:    'rgba(34,211,238,0.15)',

  secondary:      '#EC4899',
  secondaryLight: 'rgba(236,72,153,0.15)',

  success:        '#10B981',
  warning:        '#F59E0B',
  error:          '#EF4444',

  // Text
  text:           '#F1F5F9',
  textSecondary:  '#94A3B8',
  textTertiary:   '#475569',

  // Borders
  border:         'rgba(255,255,255,0.08)',
  borderLight:    'rgba(255,255,255,0.04)',
  borderGlow:     'rgba(124,58,237,0.5)',

  // Furigana
  furigana:       '#22D3EE',

  // Navigation
  tabBar:         '#0D0D1E',
  tabBarBorder:   'rgba(255,255,255,0.06)',

  // JLPT
  jlptColors: {
    N5: '#10B981',
    N4: '#3B82F6',
    N3: '#8B5CF6',
    N2: '#F59E0B',
    N1: '#EF4444',
  },

  // Gradients (arrays for LinearGradient)
  gradientPrimary:  ['#7C3AED', '#EC4899'],
  gradientAccent:   ['#22D3EE', '#7C3AED'],
  gradientHero:     ['#1A0A3C', '#06060F'],
  gradientCard:     ['rgba(124,58,237,0.14)', 'rgba(34,211,238,0.05)'],
  gradientSurface:  ['#111128', '#06060F'],

  shadow:   'rgba(0,0,0,0.6)',
  overlay:  'rgba(0,0,0,0.75)',
  isDark:   true,
};

export const lightTheme = {
  background:     '#F8FAFC',
  surface:        '#FFFFFF',
  surfaceAlt:     '#F1F5F9',
  card:           'rgba(0,0,0,0.02)',
  cardHighlight:  'rgba(109,40,217,0.06)',

  primary:        '#6D28D9',
  primaryLight:   'rgba(109,40,217,0.1)',
  primaryGlow:    'rgba(109,40,217,0.2)',

  accent:         '#0891B2',
  accentLight:    'rgba(8,145,178,0.1)',

  secondary:      '#DB2777',
  secondaryLight: 'rgba(219,39,119,0.1)',

  success:        '#059669',
  warning:        '#D97706',
  error:          '#DC2626',

  text:           '#0F172A',
  textSecondary:  '#64748B',
  textTertiary:   '#94A3B8',

  border:         'rgba(0,0,0,0.08)',
  borderLight:    'rgba(0,0,0,0.04)',
  borderGlow:     'rgba(109,40,217,0.35)',

  furigana:       '#0891B2',

  tabBar:         '#FFFFFF',
  tabBarBorder:   'rgba(0,0,0,0.08)',

  jlptColors: {
    N5: '#059669',
    N4: '#2563EB',
    N3: '#7C3AED',
    N2: '#D97706',
    N1: '#DC2626',
  },

  gradientPrimary:  ['#6D28D9', '#DB2777'],
  gradientAccent:   ['#0891B2', '#6D28D9'],
  gradientHero:     ['#EDE9FE', '#F8FAFC'],
  gradientCard:     ['rgba(109,40,217,0.06)', 'rgba(8,145,178,0.02)'],
  gradientSurface:  ['#FFFFFF', '#F8FAFC'],

  shadow:   'rgba(0,0,0,0.08)',
  overlay:  'rgba(0,0,0,0.5)',
  isDark:   false,
};
