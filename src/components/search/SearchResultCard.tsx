import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Spot } from '@/types/supabase';
import { formatDistance } from '@/utils/geo';
import { colors } from '@theme/colors';
import { typography } from '@theme/typography';
import { borderRadius, spacing } from '@theme/spacing';

interface SearchResultCardProps {
  spot: Spot;
  distance: number;
  query: string;
  onPress: () => void;
}

function HighlightedText({ text, query }: { text: string; query: string }) {
  if (!query) {
    return <Text style={styles.spotName}>{text}</Text>;
  }

  const parts = text.split(query);
  if (parts.length === 1) {
    return <Text style={styles.spotName}>{text}</Text>;
  }

  return (
    <Text style={styles.spotName}>
      {parts.map((part, index) => (
        <React.Fragment key={index}>
          {part}
          {index < parts.length - 1 && (
            <Text testID={`highlight-${query}`} style={styles.highlight}>
              {query}
            </Text>
          )}
        </React.Fragment>
      ))}
    </Text>
  );
}

export const SearchResultCard: React.FC<SearchResultCardProps> = ({
  spot,
  distance,
  query,
  onPress,
}) => {
  const isShrine = spot.type === 'shrine';

  return (
    <Pressable testID="search-result-card" onPress={onPress} style={styles.container}>
      <View
        testID={`spot-icon-${spot.type}`}
        style={[styles.iconContainer, isShrine ? styles.iconShrine : styles.iconTemple]}
      >
        <MaterialIcons
          name={isShrine ? 'temple-hindu' : 'temple-buddhist'}
          size={36}
          color={isShrine ? colors.shrine[600] : colors.temple[600]}
        />
      </View>

      <View style={styles.info}>
        <HighlightedText text={spot.name} query={query} />
        <Text style={styles.address} numberOfLines={1}>
          {spot.address || ''}
        </Text>
        <Text style={styles.distance}>{formatDistance(distance)}</Text>
      </View>

      <MaterialIcons name="chevron-right" size={24} color={colors.gray[400]} />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconShrine: {
    backgroundColor: colors.shrine[100],
  },
  iconTemple: {
    backgroundColor: colors.temple[100],
  },
  info: {
    flex: 1,
    gap: spacing.xs,
  },
  spotName: {
    ...typography.body,
    color: colors.gray[800],
    fontWeight: '600',
  },
  highlight: {
    color: colors.primary[500],
  },
  address: {
    ...typography.bodySmall,
    color: colors.gray[500],
  },
  distance: {
    ...typography.bodySmall,
    color: colors.gray[500],
  },
});
