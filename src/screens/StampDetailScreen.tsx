import { StyleSheet, Text, View } from 'react-native';

import type { GalleryStackScreenProps } from '@/navigation/types';

type Props = GalleryStackScreenProps<'StampDetail'>;

export function StampDetailScreen(_props: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>StampDetail</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontSize: 24,
    fontWeight: 'bold',
  },
});
