import React, { useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { SearchBar } from '@components/common/SearchBar';
import { Badge } from '@components/common/Badge';
import type { Spot } from '@/types/supabase';
import { colors } from '@theme/colors';
import { typography } from '@theme/typography';
import { spacing, borderRadius } from '@theme/spacing';
import { shadows } from '@theme/shadows';
import { normalizeSpotName } from '@utils/spotName';

export interface SpotWithDistance {
  spot: Spot;
  distanceKm: number;
}

interface SpotSelectorProps {
  selectedSpot: Spot | null;
  nearbySpots: SpotWithDistance[];
  searchQuery: string;
  onSearchQueryChange: (q: string) => void;
  onSelectSpot: (spot: Spot) => void;
  error: string | null;
  /** 現在地から自動で選ばれた状態か。勝手に選ばれたことを隠さないためのラベルを出す */
  isAutoSelected?: boolean;
  /** 似た名前の寺社（「もしかして」。Issue #248） */
  didYouMeanSpots?: SpotWithDistance[];
  /** 距離を出してよいか（位置情報が許可されているときだけ） */
  showDistance?: boolean;
  /** 「〇〇を調べて追加」。無ければ行を出さない */
  onResearch?: (name: string) => void;
}

/** 「調べて追加」を出すのは2文字から */
const RESEARCH_MIN_CHARS = 2;

export function SpotSelector({
  selectedSpot,
  nearbySpots,
  searchQuery,
  onSearchQueryChange,
  onSelectSpot,
  error,
  isAutoSelected = false,
  didYouMeanSpots = [],
  showDistance = true,
  onResearch,
}: SpotSelectorProps) {
  const [showDropdown, setShowDropdown] = useState(false);

  const query = searchQuery.trim();
  // 目当ての名前がそのまま候補にあるときは出さない。部分一致の候補（「八幡」で他の八幡）だけなら出す（D-10）
  const canResearch =
    !!onResearch &&
    query.length >= RESEARCH_MIN_CHARS &&
    !nearbySpots.some(i => normalizeSpotName(i.spot.name) === normalizeSpotName(query));

  const handleResearch = () => {
    setShowDropdown(false);
    onResearch?.(query);
  };

  const handleSelectSpot = (spot: Spot) => {
    onSelectSpot(spot);
    setShowDropdown(false);
    onSearchQueryChange('');
  };

  const handleFocus = () => {
    setShowDropdown(true);
  };

  const handleClear = () => {
    onSearchQueryChange('');
  };

  return (
    <View style={styles.wrapper}>
      {selectedSpot && !showDropdown ? (
        <TouchableOpacity
          style={[styles.selectedRow, error && styles.selectedRowError]}
          onPress={() => setShowDropdown(true)}
          activeOpacity={0.7}
          testID="spot-selector-trigger"
        >
          <View style={styles.selectedTextGroup}>
            <Text style={styles.selectedName}>{selectedSpot.name}</Text>
            {isAutoSelected && (
              <Text style={styles.autoSelectedLabel} testID="spot-auto-selected-label">
                現在地から自動選択
              </Text>
            )}
          </View>
          <Badge type={selectedSpot.type} />
        </TouchableOpacity>
      ) : (
        <View testID="spot-selector-trigger">
          <SearchBar
            value={searchQuery}
            onChangeText={onSearchQueryChange}
            onFocus={handleFocus}
            placeholder="スポット名で検索"
            showClearButton={searchQuery.length > 0}
            onClear={handleClear}
          />
        </View>
      )}
      {error && !showDropdown && <Text style={styles.errorText}>{error}</Text>}

      {showDropdown && (
        <View style={styles.dropdown}>
          <FlatList
            data={nearbySpots}
            keyExtractor={item => item.spot.id}
            keyboardShouldPersistTaps="handled"
            style={styles.list}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.spotRow}
                onPress={() => handleSelectSpot(item.spot)}
                activeOpacity={0.7}
                testID={`spot-option-${item.spot.id}`}
              >
                <View style={styles.spotInfo}>
                  <Text style={styles.spotName} numberOfLines={1}>
                    {item.spot.name}
                  </Text>
                  <Badge type={item.spot.type} />
                </View>
                {/* 同名が 27 種 60 件あり名前だけでは判別できない。行が狭いので県だけ */}
                {item.spot.prefecture && (
                  <Text style={styles.prefecture} numberOfLines={1}>
                    {item.spot.prefecture}
                  </Text>
                )}
                <Text style={styles.distance}>{item.distanceKm.toFixed(1)}km</Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              canResearch || didYouMeanSpots.length > 0 ? null : (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>候補が見つかりません</Text>
                </View>
              )
            }
            ListFooterComponent={
              <>
                {didYouMeanSpots.length > 0 && (
                  <View testID="spot-did-you-mean">
                    <Text style={styles.maybe}>もしかして</Text>
                    {didYouMeanSpots.map(item => (
                      <TouchableOpacity
                        key={item.spot.id}
                        style={styles.spotRow}
                        onPress={() => handleSelectSpot(item.spot)}
                        activeOpacity={0.7}
                        testID={`spot-did-you-mean-${item.spot.id}`}
                      >
                        <View style={styles.spotInfo}>
                          <Text style={styles.spotName} numberOfLines={1}>
                            {item.spot.name}
                          </Text>
                          <Badge type={item.spot.type} />
                        </View>
                        {item.spot.prefecture && (
                          <Text style={styles.prefecture} numberOfLines={1}>
                            {item.spot.prefecture}
                          </Text>
                        )}
                        {showDistance && (
                          <Text style={styles.distance}>{item.distanceKm.toFixed(0)}km</Text>
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                {canResearch && (
                  <TouchableOpacity
                    style={styles.researchRow}
                    onPress={handleResearch}
                    activeOpacity={0.7}
                    testID="spot-research"
                    accessibilityRole="button"
                  >
                    <View style={styles.researchPlus}>
                      <MaterialIcons name="add" size={20} color={colors.white} />
                    </View>
                    <View style={styles.researchText}>
                      <Text style={styles.researchTitle} numberOfLines={1}>
                        {`「${query}」を調べて追加`}
                      </Text>
                      <Text style={styles.researchSub}>名前から場所と住所を調べます</Text>
                    </View>
                  </TouchableOpacity>
                )}
              </>
            }
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    zIndex: 10,
  },
  selectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.gray[200],
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.white,
  },
  selectedRowError: {
    borderColor: colors.error,
  },
  selectedTextGroup: {
    flex: 1,
  },
  selectedName: {
    ...typography.body,
    color: colors.gray[800],
  },
  autoSelectedLabel: {
    ...typography.caption,
    color: colors.gray[500],
    marginTop: spacing.xs,
  },
  errorText: {
    ...typography.caption,
    color: colors.error,
    marginTop: spacing.xs,
  },
  dropdown: {
    marginTop: spacing.xs,
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    ...shadows.md,
  },
  list: {
    maxHeight: 240,
  },
  spotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray[200],
  },
  spotInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  spotName: {
    ...typography.body,
    color: colors.gray[800],
    // 親の flex だけでは Text は縮まない。長い名前で県と距離を押し出さないため
    flexShrink: 1,
  },
  prefecture: {
    ...typography.bodySmall,
    color: colors.gray[500],
    marginLeft: spacing.sm,
  },
  distance: {
    ...typography.bodySmall,
    color: colors.gray[400],
    marginLeft: spacing.sm,
  },
  maybe: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.gray[500],
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  researchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.primary[50],
  },
  researchPlus: {
    width: 30,
    height: 30,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary[500],
    alignItems: 'center',
    justifyContent: 'center',
  },
  researchText: {
    flex: 1,
  },
  researchTitle: {
    ...typography.body,
    fontWeight: '700',
    color: colors.primary[600],
  },
  researchSub: {
    ...typography.caption,
    color: colors.gray[500],
    marginTop: 2,
  },
  emptyContainer: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    ...typography.bodySmall,
    color: colors.gray[400],
  },
});
