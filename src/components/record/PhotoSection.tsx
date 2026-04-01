import React, { useState, useEffect } from 'react';
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
  const [imageAspect, setImageAspect] = useState<number>(3 / 4);

  useEffect(() => {
    if (imageUri) {
      Image.getSize(imageUri, (w, h) => setImageAspect(w / h));
    }
  }, [imageUri]);

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
              style={[styles.preview, { aspectRatio: imageAspect }]}
              resizeMode="cover"
              testID="photo-preview"
            />
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
    alignItems: 'center',
    backgroundColor: colors.gray[100],
  },
  preview: {
    width: '100%',
    maxHeight: 400,
  },
  errorText: {
    ...typography.caption,
    color: colors.error,
    marginTop: spacing.xs,
  },
});
