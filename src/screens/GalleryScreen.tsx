import React, { useState } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@theme/colors';
import { typography } from '@theme/typography';
import { spacing, borderRadius } from '@theme/spacing';
import type { GalleryStackScreenProps } from '@/navigation/types';

type Props = GalleryStackScreenProps<'Gallery'>;

interface GalleryItem {
  id: string;
  spotName: string;
  date: string;
}

const MOCK_DATA: GalleryItem[] = [
  { id: '1', spotName: '明治神宮', date: '2024/01/15' },
  { id: '2', spotName: '浅草寺', date: '2024/01/10' },
  { id: '3', spotName: '伏見稲荷大社', date: '2024/01/05' },
  { id: '4', spotName: '東京大神宮', date: '2023/12/28' },
  { id: '5', spotName: '鶴岡八幡宮', date: '2023/12/20' },
  { id: '6', spotName: '清水寺', date: '2023/12/15' },
  { id: '7', spotName: '出雲大社', date: '2023/12/10' },
  { id: '8', spotName: '厳島神社', date: '2023/12/05' },
  { id: '9', spotName: '金閣寺', date: '2023/11/30' },
];

const NUM_COLUMNS = 3;
const SCREEN_WIDTH = Dimensions.get('window').width;
const ITEM_MARGIN = spacing.xs;
const ITEM_SIZE = (SCREEN_WIDTH - spacing.lg * 2 - ITEM_MARGIN * (NUM_COLUMNS - 1)) / NUM_COLUMNS;

export function GalleryScreen({ navigation }: Props) {
  const [sortLabel, setSortLabel] = useState('日付順');

  const handleToggleSort = () => {
    setSortLabel(prev => (prev === '日付順' ? 'スポット順' : '日付順'));
  };

  const handleItemPress = (item: GalleryItem) => {
    navigation.navigate('StampDetail', { stampId: item.id });
  };

  const renderItem = ({ item, index }: { item: GalleryItem; index: number }) => {
    const isMiddleColumn = index % NUM_COLUMNS === 1;
    return (
      <TouchableOpacity
        style={[styles.gridItem, isMiddleColumn && styles.gridItemMiddle]}
        onPress={() => handleItemPress(item)}
        testID={`gallery-item-${item.id}`}
      >
        <View style={styles.imagePlaceholder} />
        <Text style={styles.itemSpotName} numberOfLines={1}>
          {item.spotName}
        </Text>
        <Text style={styles.itemDate}>{item.date}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>ギャラリー</Text>
      </View>

      <View style={styles.sortRow}>
        <TouchableOpacity onPress={handleToggleSort} testID="sort-button">
          <Text style={styles.sortText}>{sortLabel} ▼</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={MOCK_DATA}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        numColumns={NUM_COLUMNS}
        contentContainerStyle={styles.listContent}
        testID="gallery-list"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  headerTitle: {
    ...typography.h2,
    color: colors.gray[800],
  },
  sortRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  sortText: {
    ...typography.bodySmall,
    color: colors.gray[600],
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing['3xl'],
  },
  gridItem: {
    width: ITEM_SIZE,
    marginBottom: spacing.lg,
  },
  gridItemMiddle: {
    marginHorizontal: ITEM_MARGIN,
  },
  imagePlaceholder: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    backgroundColor: colors.gray[200],
    borderRadius: borderRadius.md,
  },
  itemSpotName: {
    ...typography.caption,
    color: colors.gray[800],
    marginTop: spacing.xs,
  },
  itemDate: {
    ...typography.caption,
    color: colors.gray[400],
  },
});
