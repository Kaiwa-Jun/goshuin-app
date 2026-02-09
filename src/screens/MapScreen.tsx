import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';

import { FABButton } from '@components/animated/FABButton';
import { SearchBar } from '@components/common/SearchBar';
import { LoginPromptModal } from '@components/common/LoginPromptModal';
import { useAuth } from '@hooks/useAuth';
import type { MapStackScreenProps } from '@/navigation/types';
import { colors } from '@theme/colors';
import { typography } from '@theme/typography';
import { spacing, borderRadius } from '@theme/spacing';
import { shadows } from '@theme/shadows';

type Props = MapStackScreenProps<'Map'>;

export function MapScreen({ navigation }: Props) {
  const { isAuthenticated } = useAuth();
  const [showLoginModal, setShowLoginModal] = useState(false);

  const navigateToRecord = () => {
    const parent = navigation.getParent();
    if (parent) {
      parent.navigate('Record');
    }
  };

  const handleFABPress = () => {
    if (isAuthenticated) {
      navigateToRecord();
    } else {
      setShowLoginModal(true);
    }
  };

  const handleLoginSuccess = () => {
    setShowLoginModal(false);
    navigateToRecord();
  };

  const handleFilterPress = () => {
    // TODO: フィルタードロップダウン表示
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']} testID="map-screen">
      <View style={styles.searchRow}>
        <View style={styles.searchBarWrapper}>
          <SearchBar />
        </View>
        <TouchableOpacity
          style={styles.filterButton}
          onPress={handleFilterPress}
          activeOpacity={0.7}
          testID="filter-button"
        >
          <MaterialIcons name="filter-list" size={24} color={colors.gray[600]} />
        </TouchableOpacity>
      </View>

      <View style={styles.mapPlaceholder} testID="map-area">
        <MaterialIcons name="map" size={48} color={colors.gray[300]} />
        <Text style={styles.mapPlaceholderText}>地図エリア</Text>
      </View>

      <View style={styles.fabContainer}>
        <FABButton onPress={handleFABPress} />
      </View>

      <LoginPromptModal
        visible={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onLoginSuccess={handleLoginSuccess}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  searchBarWrapper: {
    flex: 1,
  },
  filterButton: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  mapPlaceholder: {
    flex: 1,
    backgroundColor: colors.gray[100],
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  mapPlaceholderText: {
    ...typography.body,
    color: colors.gray[400],
  },
  fabContainer: {
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
  },
});
