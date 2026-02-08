import { StyleSheet, Text, View } from 'react-native';

import type { MapStackScreenProps } from '@/navigation/types';

type Props = MapStackScreenProps<'SpotDetail'>;

export function SpotDetailScreen(_props: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>SpotDetail</Text>
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
