import { StyleSheet } from 'react-native';

import { colors } from '@theme/colors';
import { shadows } from '@theme/shadows';
import { spacing } from '@theme/spacing';
import { typography } from '@theme/typography';

/**
 * シーンで共通の字の型とカード（Issue #274「画面仕様」の字の型）。
 * 値は動きの試作 v1 の CSS（.kick / .huge / .big / .sub / .card）
 */
export const sceneStyles = StyleSheet.create({
  kick: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
    color: colors.seal,
  },
  huge: {
    fontSize: 104,
    fontWeight: '800',
    lineHeight: 104,
    letterSpacing: -2,
    color: colors.gray[900],
  },
  big: {
    fontSize: typography.h1.fontSize,
    fontWeight: '800',
    lineHeight: 36,
    color: colors.gray[900],
  },
  /** 試作で 26 の大きい字 */
  big26: { fontSize: 26 },
  sub: {
    fontSize: typography.bodySmall.fontSize,
    color: colors.washiSub,
    marginTop: 6,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: spacing.lg,
    ...shadows.md,
  },
  cardTitle: {
    fontSize: typography.caption.fontSize,
    fontWeight: '800',
    color: colors.washiSub,
  },
});
