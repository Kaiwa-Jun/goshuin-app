import React from 'react';
import { Modal, StyleSheet, Text, View, Image, TouchableOpacity, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '@theme/colors';
import { typography } from '@theme/typography';
import { spacing } from '@theme/spacing';

interface ImagePreviewModalProps {
  visible: boolean;
  onClose: () => void;
  imageUrl: string;
  userName?: string | null;
  memo?: string | null;
  visitedAt?: string | null;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}/${m}/${day}`;
}

export function ImagePreviewModal({
  visible,
  onClose,
  imageUrl,
  userName,
  memo,
  visitedAt,
}: ImagePreviewModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.closeButton} onPress={onClose} testID="close-button">
          <MaterialIcons name="close" size={28} color={colors.white} />
        </TouchableOpacity>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          maximumZoomScale={3}
          minimumZoomScale={1}
        >
          <Image
            source={{ uri: imageUrl }}
            style={styles.image}
            resizeMode="contain"
            testID="preview-image"
          />
        </ScrollView>

        <View style={styles.infoContainer}>
          {userName && (
            <Text style={styles.userName} testID="preview-username">
              {userName}
            </Text>
          )}
          {memo && (
            <Text style={styles.memo} testID="preview-memo">
              {memo}
            </Text>
          )}
          {visitedAt && (
            <Text style={styles.visitedAt} testID="preview-visited-at">
              {formatDate(visitedAt)}
            </Text>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: spacing['4xl'],
    right: spacing.lg,
    zIndex: 10,
    padding: spacing.sm,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: '80%',
  },
  infoContainer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing['3xl'],
    gap: spacing.xs,
  },
  userName: {
    ...typography.body,
    color: colors.white,
    fontWeight: '600',
  },
  memo: {
    ...typography.bodySmall,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  visitedAt: {
    ...typography.caption,
    color: 'rgba(255, 255, 255, 0.6)',
  },
});
