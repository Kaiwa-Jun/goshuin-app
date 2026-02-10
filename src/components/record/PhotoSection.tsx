import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '@theme/colors';
import { typography } from '@theme/typography';
import { spacing, borderRadius } from '@theme/spacing';

interface PhotoSectionProps {
  imageUri: string | null;
  onPress: () => void;
  error: string | null;
}

export function PhotoSection({ imageUri, onPress, error }: PhotoSectionProps) {
  return (
    <View>
      <TouchableOpacity
        style={[styles.container, error && styles.containerError]}
        onPress={onPress}
        activeOpacity={0.7}
        testID="photo-section"
      >
        {imageUri ? (
          <View style={styles.previewContainer}>
            <Image
              source={{ uri: imageUri }}
              style={styles.preview}
              resizeMode="cover"
              testID="photo-preview"
            />
            <View style={styles.changeButton}>
              <Text style={styles.changeText}>変更</Text>
            </View>
          </View>
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.cameraIcon}>📷</Text>
            <Text style={styles.placeholderText}>写真を追加</Text>
          </View>
        )}
      </TouchableOpacity>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 2,
    borderColor: colors.gray[200],
    borderStyle: 'dashed',
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  containerError: {
    borderColor: colors.error,
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing['4xl'],
  },
  cameraIcon: {
    fontSize: 32,
    marginBottom: spacing.sm,
  },
  placeholderText: {
    ...typography.body,
    color: colors.gray[400],
  },
  previewContainer: {
    position: 'relative',
    aspectRatio: 3 / 4,
  },
  preview: {
    width: '100%',
    height: '100%',
  },
  changeButton: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  changeText: {
    ...typography.label,
    color: colors.white,
  },
  errorText: {
    ...typography.caption,
    color: colors.error,
    marginTop: spacing.xs,
  },
});
