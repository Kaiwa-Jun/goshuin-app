import React, { useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Button } from '@components/common/Button';
import { Header } from '@components/common/Header';
import { colors } from '@theme/colors';
import { typography } from '@theme/typography';
import { spacing, borderRadius } from '@theme/spacing';
import type { RootStackScreenProps } from '@/navigation/types';

type Props = RootStackScreenProps<'Record'>;

export function RecordScreen({ navigation }: Props) {
  const [selectedSpot, setSelectedSpot] = useState<string | null>(null);
  const [memo, setMemo] = useState('');

  const today = new Date();
  const formattedDate = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`;

  const handleSelectSpot = () => {
    setSelectedSpot('明治神宮');
  };

  const handleSave = () => {
    navigation.navigate('RecordComplete');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header title="御朱印を記録" variant="modal" onClose={() => navigation.goBack()} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.sectionLabel}>スポット</Text>
        <TouchableOpacity
          style={styles.spotSelector}
          onPress={handleSelectSpot}
          testID="spot-selector"
        >
          <MaterialIcons
            name="place"
            size={24}
            color={selectedSpot ? colors.primary[500] : colors.gray[400]}
          />
          <Text style={[styles.spotText, !selectedSpot && styles.spotPlaceholder]}>
            {selectedSpot ?? 'スポットを選択'}
          </Text>
          <MaterialIcons name="chevron-right" size={24} color={colors.gray[400]} />
        </TouchableOpacity>

        <Text style={styles.sectionLabel}>御朱印の写真</Text>
        <TouchableOpacity style={styles.photoArea} testID="photo-area">
          <MaterialIcons name="add-a-photo" size={48} color={colors.gray[400]} />
          <Text style={styles.photoText}>御朱印の写真を追加</Text>
        </TouchableOpacity>

        <Text style={styles.sectionLabel}>訪問日</Text>
        <View style={styles.dateRow}>
          <MaterialIcons name="calendar-today" size={20} color={colors.gray[500]} />
          <Text style={styles.dateText}>{formattedDate}</Text>
        </View>

        <Text style={styles.sectionLabel}>メモ（任意）</Text>
        <TextInput
          style={styles.memoInput}
          placeholder="メモを入力..."
          placeholderTextColor={colors.gray[400]}
          multiline
          value={memo}
          onChangeText={setMemo}
          testID="memo-input"
        />
      </ScrollView>

      <View style={styles.footer}>
        <Button title="この内容で記録する" onPress={handleSave} variant="primary" />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing['3xl'],
  },
  sectionLabel: {
    ...typography.label,
    color: colors.gray[600],
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
  },
  spotSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.gray[200],
    borderRadius: borderRadius.lg,
    backgroundColor: colors.white,
    gap: spacing.md,
  },
  spotText: {
    ...typography.body,
    color: colors.gray[800],
    flex: 1,
  },
  spotPlaceholder: {
    color: colors.gray[400],
  },
  photoArea: {
    height: 200,
    borderWidth: 2,
    borderColor: colors.gray[300],
    borderStyle: 'dashed',
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gray[50],
    gap: spacing.sm,
  },
  photoText: {
    ...typography.bodySmall,
    color: colors.gray[400],
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.gray[200],
    borderRadius: borderRadius.lg,
    backgroundColor: colors.white,
  },
  dateText: {
    ...typography.body,
    color: colors.gray[800],
  },
  memoInput: {
    ...typography.body,
    height: 100,
    borderWidth: 1,
    borderColor: colors.gray[200],
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    backgroundColor: colors.white,
    textAlignVertical: 'top',
    color: colors.gray[800],
  },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.gray[200],
    backgroundColor: colors.white,
  },
});
