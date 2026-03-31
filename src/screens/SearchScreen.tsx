import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';

import { SearchBar } from '@components/common/SearchBar';
import { FilterChips } from '@components/common/FilterChips';
import { SearchResultCard } from '@components/search/SearchResultCard';
import { SearchHistoryList } from '@components/search/SearchHistoryList';
import { useSearchScreen } from '@hooks/useSearchScreen';
import { useSearchHistory } from '@hooks/useSearchHistory';
import type { SearchHistoryItem } from '@hooks/useSearchHistory';
import type { MapStackScreenProps } from '@/navigation/types';
import { colors } from '@theme/colors';
import { typography } from '@theme/typography';
import { spacing } from '@theme/spacing';

type Props = MapStackScreenProps<'Search'>;

const FILTER_OPTIONS = [
  { key: 'all', label: 'すべて' },
  { key: 'shrine', label: '神社' },
  { key: 'temple', label: '寺院' },
];

export function SearchScreen({ navigation }: Props) {
  const { query, setQuery, results, filterType, setFilterType, clearSearch } = useSearchScreen();
  const { history, addHistory, clearHistory } = useSearchHistory();
  const insets = useSafeAreaInsets();

  const searchRowTop = insets.top + spacing.xs;
  const hasQuery = query.length > 0;
  const showEmpty = hasQuery && results.length === 0;

  const handleResultPress = (spotId: string, spotName: string) => {
    addHistory({ spotId, spotName });
    navigation.navigate('SpotDetail', { spotId });
  };

  const handleHistorySelect = (item: SearchHistoryItem) => {
    navigation.navigate('SpotDetail', { spotId: item.spotId });
  };

  return (
    <View style={styles.container} testID="search-screen">
      <View style={[styles.searchRow, { top: searchRowTop }]}>
        <View style={styles.searchBarWrapper}>
          <SearchBar
            value={query}
            onChangeText={setQuery}
            autoFocus
            showClearButton={hasQuery}
            onClear={clearSearch}
            leftIcon="back"
            onLeftIconPress={() => navigation.goBack()}
          />
        </View>
      </View>

      <View style={{ marginTop: searchRowTop + 52, flex: 1 }}>
        {hasQuery ? (
          showEmpty ? (
            <FlatList
              data={[]}
              renderItem={() => null}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              ListHeaderComponent={
                <>
                  <FilterChips
                    options={FILTER_OPTIONS}
                    selectedKey={filterType}
                    onSelect={key => setFilterType(key as 'all' | 'shrine' | 'temple')}
                  />
                  <View style={styles.emptyContainer}>
                    <MaterialIcons name="search-off" size={48} color={colors.gray[300]} />
                    <Text style={styles.emptyText}>見つかりませんでした</Text>
                  </View>
                </>
              }
            />
          ) : (
            <FlatList
              data={results}
              keyExtractor={item => item.spot.id}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              ListHeaderComponent={
                <>
                  <FilterChips
                    options={FILTER_OPTIONS}
                    selectedKey={filterType}
                    onSelect={key => setFilterType(key as 'all' | 'shrine' | 'temple')}
                  />
                  <Text style={styles.sectionTitle}>検索結果</Text>
                </>
              }
              renderItem={({ item }) => (
                <SearchResultCard
                  spot={item.spot}
                  distance={item.distance}
                  query={query}
                  onPress={() => handleResultPress(item.spot.id, item.spot.name)}
                />
              )}
            />
          )
        ) : (
          <SearchHistoryList
            history={history}
            onSelect={handleHistorySelect}
            onClear={clearHistory}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  searchRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  searchBarWrapper: {
    flex: 1,
  },
  sectionTitle: {
    ...typography.bodySmall,
    color: colors.gray[500],
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
    gap: spacing.md,
  },
  emptyText: {
    ...typography.body,
    color: colors.gray[400],
  },
});
