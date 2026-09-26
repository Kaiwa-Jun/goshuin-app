import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text } from 'react-native';

import { colors } from '@theme/colors';

/** ✕。上のバーの下・右上。いつでも閉じる */
export function CloseButton({ onPress, top }: { onPress: () => void; top: number }) {
  return (
    <Pressable
      testID="annual-report-close"
      accessibilityRole="button"
      accessibilityLabel="閉じる"
      hitSlop={8}
      onPress={onPress}
      style={[styles.close, { top }]}
    >
      <MaterialIcons name="close" size={26} color={colors.gray[900]} style={styles.closeIcon} />
    </Pressable>
  );
}

interface ReportButtonProps {
  label: string;
  onPress: () => void;
  /** primary: 朱の地に白（もう一度見る）/ secondary: 枠だけ（閉じる） */
  variant: 'primary' | 'secondary';
  testID?: string;
}

/** 締めと、空・失敗の画面のボタン */
export function ReportButton({ label, onPress, variant, testID }: ReportButtonProps) {
  const primary = variant === 'primary';
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.button, primary ? styles.primary : styles.secondary]}
    >
      <Text style={[styles.label, primary ? styles.primaryLabel : styles.secondaryLabel]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  close: {
    position: 'absolute',
    right: 14,
    zIndex: 6,
  },
  closeIcon: { opacity: 0.6 },
  button: {
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: { backgroundColor: colors.seal },
  secondary: { borderWidth: 1, borderColor: colors.gray[300] },
  label: { fontSize: 16, fontWeight: '800' },
  primaryLabel: { color: colors.white },
  secondaryLabel: { color: colors.gray[900] },
});
