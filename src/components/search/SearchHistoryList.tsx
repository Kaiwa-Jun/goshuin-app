import React from 'react';
import { View, Text, FlatList, Pressable, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import type { SearchHistoryItem } from '@hooks/useSearchHistory';
import { colors } from '@theme/colors';
import { typography } from '@theme/typography';
import { spacing } from '@theme/spacing';

interface SearchHistoryListProps {
  history: SearchHistoryItem[];
  onSelect: (item: SearchHistoryItem) => void;
  onClear: () => void;
}

export function SearchHistoryList({ history, onSelect, onClear }: SearchHistoryListProps) {
  const renderHeader = () => {
    if (history.length === 0) {
      return null;
    }

    return (
      <View style={styles.header}>
        <Text style={styles.headerTitle}>最近の検索</Text>
        <TouchableOpacity testID="clear-history-button" onPress={onClear}>
          <Text style={styles.clearButton}>クリア</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>検索履歴はありません</Text>
    </View>
  );

  const renderItem = ({ item }: { item: SearchHistoryItem }) => (
    <Pressable testID="history-item" style={styles.item} onPress={() => onSelect(item)}>
      <MaterialIcons name="history" size={20} color={colors.gray[400]} />
      <Text style={styles.itemText}>{item.spotName}</Text>
    </Pressable>
  );

  return (
    <FlatList
      data={history}
      keyExtractor={item => item.spotId}
      renderItem={renderItem}
      ListHeaderComponent={renderHeader}
      ListEmptyComponent={renderEmpty}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    />
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerTitle: {
    ...typography.bodySmall,
    color: colors.gray[500],
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  clearButton: {
    ...typography.bodySmall,
    color: colors.primary[500],
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  itemText: {
    ...typography.body,
    color: colors.gray[800],
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    ...typography.body,
    color: colors.gray[400],
  },
});
