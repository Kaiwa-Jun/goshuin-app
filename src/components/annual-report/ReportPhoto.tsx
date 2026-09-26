import { MaterialIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { getStampImageUrl, getStampThumbUrl, getStampViewUrl } from '@services/stamps';
import { colors } from '@theme/colors';
import { shadows } from '@theme/shadows';
import { borderRadius } from '@theme/spacing';

interface Props {
  imagePath: string | null;
  /** view: 表紙・いちばん多く参った / thumb: コラージュ */
  variant: 'view' | 'thumb';
  style?: StyleProp<ViewStyle>;
}

/**
 * 年報の写真（Issue #274 D-14）。縮小版 → 元の写真 → 写真の枠 の順に落とす。
 * 古い記録は縮小版がまだ焼かれていないことがある。見本（imagePath が null）は最初から枠
 */
export function ReportPhoto({ imagePath, variant, style }: Props) {
  const [stage, setStage] = useState<'variant' | 'original' | 'failed'>('variant');

  if (imagePath === null || stage === 'failed') {
    return (
      <View testID="annual-photo-placeholder" style={[styles.frame, styles.placeholder, style]}>
        <MaterialIcons name="photo" size={24} color={colors.washiSub} />
      </View>
    );
  }

  const uri =
    stage === 'original'
      ? getStampImageUrl(imagePath)
      : variant === 'view'
        ? getStampViewUrl(imagePath)
        : getStampThumbUrl(imagePath);

  return (
    <View style={[styles.frame, style]}>
      <Image
        testID="annual-photo-image"
        source={{ uri }}
        style={styles.image}
        resizeMode="cover"
        onError={() => setStage(prev => (prev === 'variant' ? 'original' : 'failed'))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderRadius: borderRadius.md,
    backgroundColor: colors.washiShade,
    ...shadows.md,
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
    borderRadius: borderRadius.md,
  },
});
