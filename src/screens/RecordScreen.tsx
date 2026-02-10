import React, { useRef, useState } from 'react';
import {
  StyleSheet,
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
import { ConfirmModal } from '@components/record/ConfirmModal';
import { useRecordForm } from '@hooks/useRecordForm';
import { useNearbySpots } from '@hooks/useNearbySpots';
import { useAuth } from '@hooks/useAuth';
import { useLocation } from '@hooks/useLocation';
import { getStampImageUrl } from '@services/stamps';
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

  const [showPhotoPicker, setShowPhotoPicker] = useState(false);
  const [showSpotAdd, setShowSpotAdd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const formattedDate = `${form.visitedAt.getFullYear()}年${form.visitedAt.getMonth() + 1}月${form.visitedAt.getDate()}日`;

  const handleSavePress = () => {
    if (!form.validate()) return;
    setShowConfirm(true);
  };

  const handleConfirm = async () => {
    const result = await form.submit();
    setShowConfirm(false);
    if (result.success && result.stamp) {
      navigation.navigate('RecordComplete', {
        stampImageUrl: getStampImageUrl(result.stamp.image_path),
        spotName: form.selectedSpot?.name,
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
            onPress={() => setShowDatePicker(true)}
            testID="date-picker-trigger"
          >
            <MaterialIcons name="calendar-today" size={20} color={colors.gray[500]} />
            <Text style={styles.dateText}>{formattedDate}</Text>
          </TouchableOpacity>
          {showDatePicker && (
            <View>
              <DateTimePicker
                value={form.visitedAt}
                mode="date"
                display={Platform.OS === 'ios' ? 'inline' : 'default'}
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

          {form.submitError && (
            <Text style={styles.submitError} testID="submit-error">
              {form.submitError}
            </Text>
          )}
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

      {form.selectedSpot && (
        <ConfirmModal
          visible={showConfirm}
          onClose={() => setShowConfirm(false)}
          onConfirm={handleConfirm}
          spotName={form.selectedSpot.name}
          spotType={form.selectedSpot.type}
          visitedAt={form.visitedAt}
          isSubmitting={form.isSubmitting}
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
  submitError: {
    ...typography.bodySmall,
    color: colors.error,
    marginTop: spacing.md,
    textAlign: 'center',
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
