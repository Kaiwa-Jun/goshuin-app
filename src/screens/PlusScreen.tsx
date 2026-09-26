import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';

import { PlusMiniCalendar } from '@components/plus/PlusMiniCalendar';
import { PlusPlanCards } from '@components/plus/PlusPlanCards';
import { PlusPurchasePanel } from '@components/plus/PlusPurchasePanel';
import { usePlus } from '@hooks/usePlus';
import type { RootStackScreenProps } from '@/navigation/types';
import { colors } from '@theme/colors';
import { typography } from '@theme/typography';
import { spacing } from '@theme/spacing';

type Props = RootStackScreenProps<'Plus'>;

/**
 * 「御朱印さんぽ プラス」の画面（Issue #270 の E / D-17）。設定から開く。
 * 将来の約束（今後の機能も追加の支払いなしで、など）は書かない
 */
export function PlusScreen({ navigation }: Props) {
  const plus = usePlus();
  const today = useMemo(() => new Date(), []);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.bar}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.back}
          accessibilityLabel="戻る"
          testID="plus-back"
        >
          <MaterialIcons name="chevron-left" size={28} color={colors.gray[700]} />
        </TouchableOpacity>
        <Text style={styles.barTitle}>御朱印さんぽ プラス</Text>
        <View style={styles.back} />
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.brand}>
          <MaterialIcons name="auto-awesome" size={16} color={colors.primary[700]} />
          <Text style={styles.brandText}>御朱印さんぽ プラス</Text>
        </View>
        <Text style={styles.title}>予定を、先までいくつでも</Text>
        <PlusMiniCalendar today={today} />
        <PlusPlanCards priceString={plus.priceString} isPlus={plus.isPlus} />
        <PlusPurchasePanel
          plus={plus}
          showRestore
          onPurchased={() =>
            navigation.popTo('MainTabs', { screen: 'Settings', params: { purchased: true } })
          }
          onTerms={() => navigation.navigate('TermsOfService')}
          onPrivacy={() => navigation.navigate('PrivacyPolicy')}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray[200],
  },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  barTitle: {
    ...typography.body,
    fontWeight: '700',
    color: colors.gray[900],
    flex: 1,
    textAlign: 'center',
  },
  body: { padding: spacing.lg, paddingBottom: spacing['4xl'] },
  brand: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  brandText: { ...typography.caption, fontWeight: '800', color: colors.primary[700] },
  title: { ...typography.h2, fontWeight: '800', color: colors.gray[900], marginTop: spacing.xs },
});
