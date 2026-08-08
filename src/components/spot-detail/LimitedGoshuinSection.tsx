import React from 'react';
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { colors } from '@theme/colors';
import { typography } from '@theme/typography';
import { spacing, borderRadius } from '@theme/spacing';
import type { LimitedGoshuinInfo, LimitedGoshuinItem, SpotSnsLink } from '@/types/supabase';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** JST（UTC+9 固定・日本に DST は無い）の YYYY-MM-DD を返す */
export function toJstDateString(now: Date): string {
  return new Date(now.getTime() + JST_OFFSET_MS).toISOString().slice(0, 10);
}

/** JST の YYYY/MM/DD HH:mm。パース不能なら空文字 */
export function formatFetchedAt(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return '';
  const jst = new Date(parsed.getTime() + JST_OFFSET_MS).toISOString();
  return `${jst.slice(0, 10).replace(/-/g, '/')} ${jst.slice(11, 16)}`;
}

/**
 * period_end が JST の当日より前の項目を除外する。
 * period_end が null / 不正形式の項目は判定できないため残す。入力は破壊しない。
 */
export function filterActiveItems(items: LimitedGoshuinItem[], now: Date): LimitedGoshuinItem[] {
  const today = toJstDateString(now);
  return items.filter(item => {
    const periodEnd = item.period_end;
    if (typeof periodEnd !== 'string' || !DATE_PATTERN.test(periodEnd)) return true;
    return periodEnd >= today;
  });
}

function hostLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

interface LimitedGoshuinSectionProps {
  info?: LimitedGoshuinInfo;
  snsLinks?: SpotSnsLink[];
  variant?: 'full' | 'compact';
}

const INSTAGRAM_HOSTS = ['instagram.com', 'www.instagram.com', 'm.instagram.com'];

/**
 * 出典リンクの文言。Instagram の投稿 permalink に「公式サイトで確認」と表示するのは
 * 事実と異なるため、ホストで切り替える（Issue #111）。パース不能は従来文言のまま。
 */
export function sourceLinkLabel(url: string): string {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return INSTAGRAM_HOSTS.includes(hostname) ? 'Instagramの投稿を見る' : '公式サイトで確認';
  } catch {
    return '公式サイトで確認';
  }
}

export function LimitedGoshuinSection({
  info,
  snsLinks,
  variant = 'full',
}: LimitedGoshuinSectionProps) {
  const activeItems = filterActiveItems(info?.items ?? [], new Date());
  const links = snsLinks ?? [];

  if (variant === 'compact') {
    if (activeItems.length === 0) return null;
    return (
      <View style={styles.compactChip} testID="limited-goshuin-compact">
        <MaterialIcons name="auto-awesome" size={14} color={colors.primary[500]} />
        <Text style={styles.compactText}>{`限定御朱印 ${activeItems.length}件`}</Text>
      </View>
    );
  }

  if (activeItems.length === 0 && links.length === 0) return null;

  return (
    <View style={styles.container} testID="limited-goshuin-section">
      <Text style={styles.heading}>限定御朱印</Text>
      {activeItems.map((item, index) => (
        <View
          style={styles.item}
          key={`${item.source_url}-${index}`}
          testID={`limited-goshuin-item-${index}`}
        >
          <Text style={styles.itemName}>{item.name}</Text>
          {item.period != null && (
            <Text style={styles.itemPeriod} testID={`limited-goshuin-period-${index}`}>
              {`期間 ${item.period}`}
            </Text>
          )}
          {item.description != null && (
            <Text
              style={styles.itemDescription}
              numberOfLines={3}
              testID={`limited-goshuin-description-${index}`}
            >
              {item.description}
            </Text>
          )}
          <TouchableOpacity
            style={styles.linkRow}
            testID={`limited-goshuin-source-${index}`}
            onPress={() => Linking.openURL(item.source_url)}
          >
            <MaterialIcons name="open-in-new" size={14} color={colors.primary[500]} />
            <Text style={styles.linkText}>{sourceLinkLabel(item.source_url)}</Text>
          </TouchableOpacity>
        </View>
      ))}
      {activeItems.length > 0 && info != null && (
        <Text style={styles.fetchedAt} testID="limited-goshuin-fetched-at">
          {`取得 ${formatFetchedAt(info.fetched_at)}`}
        </Text>
      )}
      {links.length > 0 && (
        <>
          <Text style={styles.snsHeading}>公式SNS</Text>
          {links.map((link, index) => (
            <TouchableOpacity
              style={styles.linkRow}
              key={link.id}
              testID={`limited-goshuin-sns-${index}`}
              onPress={() => Linking.openURL(link.url)}
            >
              <MaterialIcons name="open-in-new" size={14} color={colors.primary[500]} />
              <Text style={styles.linkText}>{hostLabel(link.url)}</Text>
            </TouchableOpacity>
          ))}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.xl,
  },
  heading: {
    ...typography.h3,
    color: colors.gray[800],
    marginBottom: spacing.sm,
  },
  item: {
    marginBottom: spacing.md,
  },
  itemName: {
    ...typography.body,
    color: colors.gray[900],
  },
  itemPeriod: {
    ...typography.bodySmall,
    color: colors.gray[600],
    marginTop: spacing.xs,
  },
  itemDescription: {
    ...typography.bodySmall,
    color: colors.gray[500],
    marginTop: spacing.xs,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
    alignSelf: 'flex-start',
  },
  linkText: {
    ...typography.caption,
    color: colors.primary[500],
  },
  fetchedAt: {
    ...typography.caption,
    color: colors.gray[400],
  },
  snsHeading: {
    ...typography.caption,
    color: colors.gray[500],
    marginTop: spacing.sm,
  },
  compactChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.gray[50],
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    alignSelf: 'flex-start',
  },
  compactText: {
    ...typography.caption,
    color: colors.gray[600],
  },
});
