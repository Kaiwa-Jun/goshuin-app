import React, { useRef, useState } from 'react';
import {
  StyleSheet,
  Switch,
  Text,
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { MaterialIcons } from '@expo/vector-icons';
import { Button } from '@components/common/Button';
import { Header } from '@components/common/Header';
import { SpotSelector } from '@components/record/SpotSelector';
import { PhotoSection } from '@components/record/PhotoSection';
import { PhotoPickerModal } from '@components/record/PhotoPickerModal';
import { SpotAddModal } from '@components/record/SpotAddModal';
import { useRecordForm } from '@hooks/useRecordForm';
import { useNearbySpots } from '@hooks/useNearbySpots';
import { useAuth } from '@hooks/useAuth';
import { useLocation } from '@hooks/useLocation';
import { formatJapaneseEraDate } from '@utils/japaneseEra';
import { getStampImageUrl, fetchVisitedSpotIds } from '@services/stamps';
import { isNetworkError } from '@/utils/errorClassifier';
import { evaluateNewBadge } from '@services/badges';
import { colors } from '@theme/colors';
import { typography } from '@theme/typography';
import { spacing, borderRadius } from '@theme/spacing';
import type { RootStackScreenProps } from '@/navigation/types';

type Props = RootStackScreenProps<'Record'>;

export function RecordScreen({ navigation, route }: Props) {
  const initialSpotId = route.params?.spotId;
  const { user } = useAuth();
  const { location } = useLocation();
  const { filteredSpots, searchQuery, setSearchQuery } = useNearbySpots();
  const form = useRecordForm(initialSpotId ? { initialSpotId } : undefined);

  const scrollViewRef = useRef<ScrollView>(null);
  const memoLayoutY = useRef(0);
  const dateLayoutY = useRef(0);

  const [showPhotoPicker, setShowPhotoPicker] = useState(false);
  const [showSpotAdd, setShowSpotAdd] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const formattedDate = `${form.visitedAt.getFullYear()}年${form.visitedAt.getMonth() + 1}月${form.visitedAt.getDate()}日`;
  // 紙の御朱印は和暦で書かれている。ピッカーは西暦なので、照合できるよう併記する（監査 A-2）
  const eraDate = formatJapaneseEraDate(
    `${form.visitedAt.getFullYear()}-${String(form.visitedAt.getMonth() + 1).padStart(2, '0')}-${String(form.visitedAt.getDate()).padStart(2, '0')}`
  );

  // 確認モーダルは廃止した（D-3）。モーダルが出していたのはスポット名と訪問日だけで
  // どちらも直前のフォーム上に見えており、一番間違えやすい写真は確認していなかった。
  // 誤登録は記録完了画面の「記録を取り消す」で回復する
  const handleSavePress = async () => {
    if (!form.validate()) return;

    const visitedSpotIds = await fetchVisitedSpotIds();
    const previousCount = visitedSpotIds.size;

    const result = await form.submit();

    if (result.success && result.stamp) {
      const isNewSpot = form.selectedSpot ? !visitedSpotIds.has(form.selectedSpot.id) : false;
      const currentCount = isNewSpot ? previousCount + 1 : previousCount;
      const badge = evaluateNewBadge(previousCount, currentCount);

      navigation.navigate('RecordComplete', {
        stampImageUrl: getStampImageUrl(result.stamp.image_path),
        spotName: form.selectedSpot?.name,
        visitCount: currentCount,
        badge,
        // 取り消し（deleteStamp）に ID と画像パスの両方が要る
        stampId: result.stamp.id,
        imagePath: result.stamp.image_path,
      });
    } else if (!result.success) {
      const errorType = isNetworkError(result.error) ? 'network' : 'upload';
      navigation.navigate('Error', {
        type: errorType,
        origin: 'record',
        stage: result.stage,
        message: result.message,
      });
    }
  };

  const handleDateChange = (_event: unknown, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (selectedDate) {
      form.setVisitedAt(selectedDate);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header title="御朱印を記録" variant="modal" onClose={() => navigation.goBack()} />

      <KeyboardAvoidingView
        style={styles.scrollView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.sectionLabel}>スポット</Text>
          <SpotSelector
            selectedSpot={form.selectedSpot}
            nearbySpots={filteredSpots}
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            onSelectSpot={form.selectSpot}
            onAddSpotPress={() => setShowSpotAdd(true)}
            error={form.spotError}
          />

          <Text style={styles.sectionLabel}>御朱印の写真</Text>
          <PhotoSection
            imageUri={form.imageUri}
            onPress={() => setShowPhotoPicker(true)}
            error={form.imageError}
          />

          <Text style={styles.sectionLabel}>訪問日</Text>
          <TouchableOpacity
            style={styles.dateRow}
            onLayout={e => {
              dateLayoutY.current = e.nativeEvent.layout.y;
            }}
            onPress={() => {
              setShowDatePicker(true);
              // iOS の inline カレンダーは ScrollView の流れの中に展開されるため、
              // そのままだと画面外に出る。メモ欄と同じ作法でスクロールさせる（監査 A-3）
              setTimeout(() => {
                scrollViewRef.current?.scrollTo({ y: dateLayoutY.current, animated: true });
              }, 300);
            }}
            testID="date-picker-trigger"
          >
            <MaterialIcons name="calendar-today" size={20} color={colors.gray[500]} />
            <View style={styles.dateTextGroup}>
              <Text style={styles.dateText}>{formattedDate}</Text>
              <Text style={styles.dateEraText} testID="date-era-label">
                {eraDate}
              </Text>
            </View>
          </TouchableOpacity>
          {showDatePicker && (
            <View>
              <DateTimePicker
                value={form.visitedAt}
                mode="date"
                // inline は「カレンダー ⇄ 年月ホイール」の2モードを持ち、年月ホイールの
                // 途中で完了を押すと日が未確定のまま閉じてしまう。spinner なら
                // 年・月・日が常に見えており、決め忘れが構造的に起きない（Issue #128）
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={handleDateChange}
                maximumDate={new Date()}
                testID="date-picker"
              />
              {Platform.OS === 'ios' && (
                <TouchableOpacity
                  style={styles.dateConfirmButton}
                  onPress={() => setShowDatePicker(false)}
                >
                  <Text style={styles.dateConfirmText}>完了</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          <Text style={styles.sectionLabel}>メモ（任意）</Text>
          <View
            onLayout={e => {
              memoLayoutY.current = e.nativeEvent.layout.y;
            }}
          >
            <TextInput
              style={styles.memoInput}
              placeholder="メモを入力..."
              placeholderTextColor={colors.gray[400]}
              multiline
              value={form.memo}
              onChangeText={form.setMemo}
              onFocus={() => {
                setTimeout(() => {
                  scrollViewRef.current?.scrollTo({
                    y: memoLayoutY.current,
                    animated: true,
                  });
                }, 300);
              }}
              testID="memo-input"
            />
          </View>

          <Text style={styles.memoGuide}>
            駐車場の有無、受付時間、アクセス情報などを書くと、{'\n'}
            スポット情報として自動的に反映されます
          </Text>

          <View style={styles.publicToggleSection}>
            <View style={styles.publicToggleRow}>
              <MaterialIcons
                name={form.isPublic ? 'public' : 'lock'}
                size={20}
                color={form.isPublic ? colors.primary[500] : colors.gray[500]}
              />
              <Text style={styles.publicToggleLabel}>この御朱印を公開する</Text>
              <Switch
                value={form.isPublic}
                onValueChange={form.setIsPublic}
                trackColor={{ false: colors.gray[300], true: colors.primary[200] }}
                thumbColor={form.isPublic ? colors.primary[500] : colors.gray[100]}
                testID="public-toggle"
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.footer}>
        <Button
          title="この内容で記録する"
          onPress={handleSavePress}
          variant="primary"
          disabled={form.isSubmitting}
        />
      </View>

      <PhotoPickerModal
        visible={showPhotoPicker}
        onClose={() => setShowPhotoPicker(false)}
        onImageSelected={uri => {
          form.setImageUri(uri);
          setShowPhotoPicker(false);
        }}
      />

      {user && (
        <SpotAddModal
          visible={showSpotAdd}
          onClose={() => setShowSpotAdd(false)}
          onSpotCreated={spot => {
            form.selectSpot(spot);
            setShowSpotAdd(false);
          }}
          userLocation={location}
          userId={user.id}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing['3xl'],
  },
  sectionLabel: {
    ...typography.label,
    color: colors.gray[600],
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.gray[200],
    borderRadius: borderRadius.lg,
    backgroundColor: colors.white,
  },
  dateText: {
    ...typography.body,
    color: colors.gray[800],
  },
  dateTextGroup: {
    flex: 1,
  },
  dateEraText: {
    ...typography.caption,
    color: colors.gray[500],
    marginTop: spacing.xs,
  },
  memoInput: {
    ...typography.body,
    height: 100,
    borderWidth: 1,
    borderColor: colors.gray[200],
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    backgroundColor: colors.white,
    textAlignVertical: 'top',
    color: colors.gray[800],
  },
  memoGuide: {
    ...typography.caption,
    color: colors.gray[400],
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  publicToggleSection: {
    marginTop: spacing.lg,
  },
  publicToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.gray[200],
    borderRadius: borderRadius.lg,
    backgroundColor: colors.white,
  },
  publicToggleLabel: {
    ...typography.body,
    color: colors.gray[800],
    flex: 1,
  },
  dateConfirmButton: {
    alignSelf: 'flex-end',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.sm,
  },
  dateConfirmText: {
    ...typography.body,
    color: colors.primary[500],
    fontWeight: '600',
  },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.gray[200],
    backgroundColor: colors.white,
  },
});
