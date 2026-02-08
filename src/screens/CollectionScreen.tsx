import { StyleSheet, Text, View } from 'react-native';

import type { MainTabScreenProps } from '@/navigation/types';

type Props = MainTabScreenProps<'Collection'>;

export function CollectionScreen(_props: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Collection</Text>
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
