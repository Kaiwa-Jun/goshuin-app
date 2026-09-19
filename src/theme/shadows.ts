import { ViewStyle } from 'react-native';

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  } as ViewStyle,

  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  } as ViewStyle,

  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  } as ViewStyle,

  /**
   * 地図のような明るい面の上に浮かせるもの用。
   *
   * sm/md/lg の大きさの段階とは別の軸。大きくぼかす（lg: 0.15 / r8）より
   * 小さく濃くした方が、ぼやけた染みではなく浮いた物体に見える。
   */
  floating: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 6,
    elevation: 6,
  } as ViewStyle,
} as const;

export type Shadows = typeof shadows;
