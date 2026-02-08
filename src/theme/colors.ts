export const colors = {
  primary: {
    50: '#FFF7ED',
    100: '#FFEDD5',
    200: '#FED7AA',
    300: '#FDBA74',
    400: '#FB923C',
    500: '#f27f0d',
    600: '#EA580C',
    700: '#C2410C',
    800: '#9A3412',
    900: '#7C2D12',
  },

  shrine: {
    50: '#FEF2F2',
    100: '#FEE2E2',
    200: '#FECACA',
    500: '#EF4444',
    600: '#DC2626',
    700: '#B91C1C',
  },

  temple: {
    50: '#FAF5FF',
    100: '#F3E8FF',
    200: '#E9D5FF',
    500: '#A855F7',
    600: '#9333EA',
    700: '#7E22CE',
  },

  gray: {
    50: '#F9FAFB',
    100: '#F3F4F6',
    200: '#E5E7EB',
    300: '#D1D5DB',
    400: '#9CA3AF',
    500: '#6B7280',
    600: '#4B5563',
    700: '#374151',
    800: '#1F2937',
    900: '#111827',
  },

  pin: {
    shrineVisited: '#EF4444',
    templeVisited: '#A855F7',
    unvisited: '#9CA3AF',
    currentLocation: '#3B82F6',
  },

  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',

  background: '#FFFFFF',
  surface: '#F9FAFB',

  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',
} as const;

export type Colors = typeof colors;
