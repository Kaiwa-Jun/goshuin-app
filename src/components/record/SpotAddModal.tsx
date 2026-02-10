import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Modal } from '@components/common/Modal';
import { Button } from '@components/common/Button';
import { createSpot } from '@/services/spots';
import type { Spot } from '@/types/supabase';
import { colors } from '@theme/colors';
import { typography } from '@theme/typography';
import { spacing, borderRadius } from '@theme/spacing';

interface SpotAddModalProps {
  visible: boolean;
  onClose: () => void;
  onSpotCreated: (spot: Spot) => void;
  userLocation: { latitude: number; longitude: number } | null;
  userId: string;
}

export function SpotAddModal({
  visible,
  onClose,
  onSpotCreated,
  userLocation,
  userId,
}: SpotAddModalProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<'shrine' | 'temple'>('shrine');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleAdd = async () => {
    if (!name.trim() || !userLocation) return;

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const spot = await createSpot({
        name: name.trim(),
        type,
        lat: userLocation.latitude,
        lng: userLocation.longitude,
        createdByUserId: userId,
      });
      onSpotCreated(spot);
      setName('');
      setType('shrine');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'スポットの追加に失敗しました';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} onClose={onClose} variant="center" title="スポットを追加">
      <TextInput
        style={styles.input}
        placeholder="スポット名を入力"
        placeholderTextColor={colors.gray[400]}
        value={name}
        onChangeText={setName}
        testID="spot-name-input"
      />
      <View style={styles.typeRow}>
        <TouchableOpacity
          style={[styles.typeButton, type === 'shrine' && styles.typeButtonActive]}
          onPress={() => setType('shrine')}
          activeOpacity={0.7}
        >
          <Text style={[styles.typeText, type === 'shrine' && styles.typeTextActive]}>神社</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.typeButton, type === 'temple' && styles.typeButtonActive]}
          onPress={() => setType('temple')}
          activeOpacity={0.7}
        >
          <Text style={[styles.typeText, type === 'temple' && styles.typeTextActive]}>寺院</Text>
        </TouchableOpacity>
      </View>
      {errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}
      <Button
        title={isSubmitting ? '追加中...' : '追加'}
        onPress={handleAdd}
        variant="primary"
        disabled={!name.trim() || isSubmitting}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  input: {
    ...typography.body,
    color: colors.gray[800],
    borderWidth: 1,
    borderColor: colors.gray[200],
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  typeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing['2xl'],
  },
  typeButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.gray[200],
    alignItems: 'center',
  },
  typeButtonActive: {
    borderColor: colors.primary[500],
    backgroundColor: colors.primary[50],
  },
  typeText: {
    ...typography.body,
    color: colors.gray[600],
  },
  typeTextActive: {
    color: colors.primary[500],
    fontWeight: '600',
  },
  errorText: {
    ...typography.bodySmall,
    color: colors.error,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
});
