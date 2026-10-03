import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';

import { SearchBar } from '@components/common/SearchBar';
import { FilterChips } from '@components/common/FilterChips';
import { SearchResultCard } from '@components/search/SearchResultCard';
import { SearchPlaceRow } from '@components/search/SearchPlaceRow';
import { SearchHistoryList } from '@components/search/SearchHistoryList';
import { useSearchScreen } from '@hooks/useSearchScreen';
import { useSearchHistory } from '@hooks/useSearchHistory';
import type { SearchHistoryItem } from '@hooks/useSearchHistory';
import type { MapStackScreenProps } from '@/navigation/types';
import type { PlaceRow, SearchRow, SpotRow, SpotTypeFilter } from '@utils/placeSearch';
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
  const {
    query,
    setQuery,
    rows,
    resolveSubmit,
    filterType,
    setFilterType,
    clearSearch,
    suggestedSpots,
    suggestionMode,
  } = useSearchScreen();
  const { history, addHistory, clearHistory } = useSearchHistory();
  const insets = useSafeAreaInsets();

  const searchRowTop = insets.top + spacing.xs;
  const hasQuery = query.length > 0;
  const showEmpty = hasQuery && rows.length === 0;
  const suggestionTitle = suggestionMode === 'nearby' ? '近くのスポット' : '人気のスポット';
  // 場所の帯は、並び（エンターの行き先）に関わらず一覧のいちばん上に出す（S0 で選ばれた B）
  const placeRows = rows.filter((r): r is PlaceRow => r.kind === 'place');
  const spotRows = rows.filter((r): r is SpotRow => r.kind === 'spot');

  // 行を押したときとエンターは同じ道を通る（Issue #311）
  const handleRowPress = (row: SearchRow) => {
    if (row.kind === 'place') {
      // 場所は履歴に残さない（L-1）
      navigation.navigate('Map', { focusRegion: row.region });
      return;
    }
    addHistory({ spotId: row.spot.id, spotName: row.spot.name });
    navigation.navigate('Map', { focusSpotId: row.spot.id });
  };

  const handleSubmit = async () => {
    const row = await resolveSubmit();
    if (row) handleRowPress(row);
  };

  const handleHistorySelect = (item: SearchHistoryItem) => {
    navigation.navigate('Map', { focusSpotId: item.spotId });
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
            onSubmitEditing={handleSubmit}
            returnKeyType="search"
            submitBehavior="submit"
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
                    onSelect={key => setFilterType(key as SpotTypeFilter)}
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
              data={spotRows}
              keyExtractor={item => item.spot.id}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              ListHeaderComponent={
                <>
                  <FilterChips
                    options={FILTER_OPTIONS}
                    selectedKey={filterType}
                    onSelect={key => setFilterType(key as SpotTypeFilter)}
                  />
                  {placeRows.map((row, i) => (
                    <SearchPlaceRow
                      key={row.key}
                      testID={`search-place-row-${i}`}
                      row={row}
                      onPress={() => handleRowPress(row)}
                    />
                  ))}
                  {spotRows.length > 0 && <Text style={styles.sectionTitle}>検索結果</Text>}
                </>
              }
              renderItem={({ item }) => (
                <SearchResultCard
                  spot={item.spot}
                  distance={item.distance}
                  query={query}
                  onPress={() => handleRowPress(item)}
                />
              )}
            />
          )
        ) : (
          <FlatList
            data={suggestedSpots}
            keyExtractor={item => item.spot.id}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            ListHeaderComponent={
              <>
                <SearchHistoryList
                  history={history}
                  onSelect={handleHistorySelect}
                  onClear={clearHistory}
                />
                {suggestedSpots.length > 0 && (
                  <Text style={styles.sectionTitle}>{suggestionTitle}</Text>
                )}
              </>
            }
            renderItem={({ item }) => (
              <SearchResultCard
                spot={item.spot}
                distance={item.distance}
                query=""
                showDistance={suggestionMode === 'nearby'}
                onPress={() => navigation.navigate('Map', { focusSpotId: item.spot.id })}
              />
            )}
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
