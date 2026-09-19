import React from 'react';
import { View, TextInput, StyleSheet, TouchableOpacity, Pressable } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '@theme/colors';
import { typography } from '@theme/typography';
import { borderRadius, spacing } from '@theme/spacing';
import { shadows } from '@theme/shadows';

interface SearchBarProps {
  placeholder?: string;
  value?: string;
  onChangeText?: (text: string) => void;
  onFocus?: () => void;
  onClear?: () => void;
  showClearButton?: boolean;
  editable?: boolean;
  onPress?: () => void;
  autoFocus?: boolean;
  leftIcon?: 'search' | 'back';
  onLeftIconPress?: () => void;
}

/** 入力欄の高さ。body の lineHeight と同じにして、検索バー全体の高さを変えない */
const INPUT_HEIGHT = typography.body.lineHeight;

export const SearchBar: React.FC<SearchBarProps> = ({
  placeholder = '神社・寺院を検索',
  value,
  onChangeText,
  onFocus,
  onClear,
  showClearButton = false,
  editable = true,
  onPress,
  autoFocus = false,
  leftIcon = 'search',
  onLeftIconPress,
}) => {
  const iconName = leftIcon === 'back' ? 'arrow-back' : 'search';
  const iconElement = onLeftIconPress ? (
    <TouchableOpacity onPress={onLeftIconPress} testID="search-left-icon" activeOpacity={0.7}>
      <MaterialIcons name={iconName} size={20} color={colors.gray[400]} />
    </TouchableOpacity>
  ) : (
    <MaterialIcons name={iconName} size={20} color={colors.gray[400]} />
  );

  const content = (
    <>
      {iconElement}
      <View style={styles.inputWrapper} pointerEvents={editable ? 'auto' : 'none'}>
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={colors.gray[400]}
          value={value}
          onChangeText={onChangeText}
          onFocus={onFocus}
          editable={editable}
          autoFocus={autoFocus}
          testID="search-input"
        />
      </View>
      {showClearButton && (
        <TouchableOpacity onPress={onClear} testID="search-clear-button" activeOpacity={0.7}>
          <MaterialIcons name="close" size={20} color={colors.gray[400]} />
        </TouchableOpacity>
      )}
    </>
  );

  if (!editable && onPress) {
    return (
      <Pressable style={styles.container} testID="search-bar" onPress={onPress}>
        {content}
      </Pressable>
    );
  }

  return (
    <View style={styles.container} testID="search-bar">
      {content}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gray[100],
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
    ...shadows.sm,
  },
  inputWrapper: {
    flex: 1,
  },
  input: {
    fontSize: typography.body.fontSize,
    fontWeight: typography.body.fontWeight,
    // typography.body を丸ごと広げない。lineHeight を TextInput に当てると
    // iOS は NSParagraphStyle として解釈し、余った行間が文字の上に入って
    // 文字が下にずれる。しかもプレースホルダは UITextField 側が描くので
    // この影響を受けず、入力の有無で文字の高さが変わってしまう。
    // 高さだけ明示して、縦の中央寄せは UITextField に任せる
    height: INPUT_HEIGHT,
    color: colors.gray[800],
    padding: 0,
  },
});
