import React, { useRef } from 'react';
import { TouchableOpacity, Animated, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '@theme/colors';

interface WishlistButtonProps {
  isWishlisted: boolean;
  onPress: () => void;
  size?: number;
}

export const WishlistButton: React.FC<WishlistButtonProps> = ({
  isWishlisted,
  onPress,
  size = 24,
}) => {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    // 追加時はXいいね風の弾むアニメーション、解除時はアニメーションなし
    if (!isWishlisted) {
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 0.8,
          duration: 80,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1.3,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1.0,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start();
    }
    onPress();
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.7}
      testID="wishlist-button"
      style={styles.touchable}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Animated.View style={[styles.container, { transform: [{ scale }] }]}>
        {isWishlisted ? (
          <MaterialIcons
            name="bookmark"
            size={size}
            color={colors.pin.wishlisted}
            testID="wishlist-button-active"
          />
        ) : (
          <MaterialIcons
            name="bookmark-border"
            size={size}
            color={colors.gray[400]}
            testID="wishlist-button-inactive"
          />
        )}
      </Animated.View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  // アイコン単体では実効タップ領域が 40pt に留まるため 44pt を明示的に確保する
  touchable: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
