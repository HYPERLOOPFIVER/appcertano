// Theme constants for Certano App
export const COLORS = {
  // Primary
  primary: '#F50057',
  primaryLight: '#FF4D4D',
  primaryDark: '#C51162',
  
  // Secondary
  secondary: '#6366F1',
  secondaryLight: '#818CF8',
  secondarySurface: '#EEF2FF',
  
  // Background
  background: '#FAFAFA',
  surface: '#FFFFFF',
  surfaceLight: '#F3F4F6',
  
  // Text
  textPrimary: '#1F2937',
  textSecondary: '#6B7280',
  textTertiary: '#9CA3AF',
  textDisabled: '#D1D5DB',
  
  // Status
  success: '#10B981',
  error: '#EF4444',
  warning: '#F59E0B',
  info: '#3B82F6',
  
  // Misc
  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(0, 0, 0, 0.5)',
  glass: 'rgba(255, 255, 255, 0.9)',
};

export const GRADIENTS = {
  brand: ['#FF4D4D', '#F50057'],
  storyRing: ['#F59E0B', '#F50057', '#C026D3'],
  purple: ['#6366F1', '#8B5CF6'],
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 40,
  xxxl: 64,
};

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  full: 9999,
};

export const FONT_SIZE = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
  '4xl': 36,
  '5xl': 48,
};

export const SHADOWS = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  lg: {
    shadowColor: '#F50057',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
};

// Animation presets for Moti
export const ANIMATIONS = {
  fadeInUp: {
    from: { opacity: 0, translateY: 20 },
    animate: { opacity: 1, translateY: 0 },
    transition: { type: 'timing', duration: 500 },
  },
  fadeIn: {
    from: { opacity: 0 },
    animate: { opacity: 1 },
    transition: { type: 'timing', duration: 300 },
  },
  slideUp: {
    from: { translateY: 100, opacity: 0 },
    animate: { translateY: 0, opacity: 1 },
    transition: { type: 'spring', damping: 15 },
  },
  scaleIn: {
    from: { scale: 0.9, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
    transition: { type: 'spring', damping: 12 },
  },
  pulse: {
    from: { scale: 1 },
    animate: { scale: 1.05 },
    transition: { 
      type: 'timing', 
      duration: 1000, 
      loop: true,
      repeatReverse: true,
    },
  },
};

export default {
  COLORS,
  GRADIENTS,
  SPACING,
  RADIUS,
  FONT_SIZE,
  SHADOWS,
  ANIMATIONS,
};
