import React, { useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import { SearchBar } from '@components/common/SearchBar';
import { Badge } from '@components/common/Badge';
import type { Spot } from '@/types/supabase';
import { colors } from '@theme/colors';
import { typography } from '@theme/typography';
import { spacing, borderRadius } from '@theme/spacing';
import { shadows } from '@theme/shadows';

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
  onAddSpotPress: () => void;
  error: string | null;
}

export function SpotSelector({
  selectedSpot,
  nearbySpots,
  searchQuery,
  onSearchQueryChange,
  onSelectSpot,
  onAddSpotPress,
  error,
}: SpotSelectorProps) {
  const [showDropdown, setShowDropdown] = useState(false);

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
          <Text style={styles.selectedName}>{selectedSpot.name}</Text>
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
              >
                <View style={styles.spotInfo}>
                  <Text style={styles.spotName} numberOfLines={1}>
                    {item.spot.name}
                  </Text>
                  <Badge type={item.spot.type} />
                </View>
                <Text style={styles.distance}>{item.distanceKm.toFixed(1)}km</Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>候補が見つかりません</Text>
              </View>
            }
          />
          <TouchableOpacity
            style={styles.addLink}
            onPress={() => {
              setShowDropdown(false);
              onAddSpotPress();
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.addLinkText}>スポットが見つからない場合は追加</Text>
          </TouchableOpacity>
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
  selectedName: {
    ...typography.body,
    color: colors.gray[800],
    flex: 1,
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
  },
  distance: {
    ...typography.bodySmall,
    color: colors.gray[400],
    marginLeft: spacing.sm,
  },
  emptyContainer: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    ...typography.bodySmall,
    color: colors.gray[400],
  },
  addLink: {
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.gray[200],
  },
  addLinkText: {
    ...typography.bodySmall,
    color: colors.primary[500],
  },
});
