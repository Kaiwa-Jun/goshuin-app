import React, { useMemo, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Platform,
  Keyboard,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { MaterialIcons } from '@expo/vector-icons';
import { Button } from '@components/common/Button';
import { Header } from '@components/common/Header';
import { SpotSelector } from '@components/record/SpotSelector';
import { PhotoSection } from '@components/record/PhotoSection';
import { SavingOverlay } from '@components/record/SavingOverlay';
import { SpotPlacePicker } from '@components/record/SpotPlacePicker';
import { SpotResearchSheet } from '@components/record/SpotResearchSheet';
import { useSpotAdd } from '@hooks/useSpotAdd';
import { useRecentPrefectures } from '@hooks/useRecentPrefectures';
import { DEFAULT_LOCATION } from '@utils/geo';
import { usePhotoPicker } from '@hooks/usePhotoPicker';
import { useRecordForm } from '@hooks/useRecordForm';
import { useNearbySpots } from '@hooks/useNearbySpots';
import { useLocation } from '@hooks/useLocation';
import { formatJapaneseEraDate } from '@utils/japaneseEra';
import { toLocalDateString } from '@utils/localDate';
import { pickAutoSelectableSpot } from '@utils/autoSelectSpot';
import { MAX_PHOTOS_PER_RECORD } from '@/constants/record';
import { scrollTargetToReveal, scrollTargetToShow } from '@utils/revealInScrollView';
import { getStampImageUrl, fetchVisitedSpotIds } from '@services/stamps';
import { fetchRegionStats, fetchVisitLog, type RegionStat } from '@services/collection';
import { buildBadgeProgress } from '@utils/badgeProgress';
import { buildMapParams } from '@utils/completeMapParams';
import { useAuth } from '@hooks/useAuth';
import { isNetworkError } from '@/utils/errorClassifier';
import { evaluateNewBadges } from '@services/badges';
import { colors } from '@theme/colors';
import { typography } from '@theme/typography';
import { spacing, borderRadius } from '@theme/spacing';
import type { RootStackScreenProps } from '@/navigation/types';
import type { RecordField } from '@hooks/useRecordForm';

type Props = RootStackScreenProps<'Record'>;

export function RecordScreen({ navigation, route }: Props) {
  const initialSpotId = route.params?.spotId;
  const { user } = useAuth();
  const { location, permissionStatus } = useLocation();
  const { nearbySpots, filteredSpots, didYouMeanSpots, searchQuery, setSearchQuery } =
    useNearbySpots();
  // 距離・手がかりは位置情報が許可されているときだけ（未許可でも useLocation は仙台を返す）
  const granted = permissionStatus === 'granted';
  const { takePhoto, pickFromLibrary } = usePhotoPicker();

  // 境内にいるときだけ最寄りを既定選択する。位置情報が未許可でも useLocation は
  // DEFAULT_LOCATION（仙台）を返すため、許可状態のガードは必須（S-4）
  const autoSelectableSpot = useMemo(
    () => pickAutoSelectableSpot(nearbySpots, permissionStatus),
    [nearbySpots, permissionStatus]
  );

  const form = useRecordForm(initialSpotId ? { initialSpotId } : { autoSelectableSpot });

  // 見つからない寺社を調べて追加し、そのまま記録に使う（Issue #248）。
  // 調べる前に地域を聞き、選んだ瞬間に調べ始める（Issue #277）。選択肢は自分の記録にある県・
  // 「全国から」・本人が入れた地域だけ。家に帰ってから記録することも多いので、いまいる場所を
  // 手がかりにしない（東京の自宅で仙台の寺社を調べると「東京都 狛江市のあたり」になって
  // 見つからなかった）。位置情報そのものは送らない
  const spotAdd = useSpotAdd(form.selectSpot);
  const handleResearch = (name: string) => spotAdd.start(name);
  // 記録画面を開いたときに1回だけ取る（押してから取るとチップが後から出て並びが動く）
  const recentPrefectures = useRecentPrefectures(user?.id ?? null);

  const scrollViewRef = useRef<ScrollView>(null);
  const memoRect = useRef({ y: 0, height: 0 });
  /** バリデーションで欠けていた欄まで連れていくために、欄の位置を覚えておく */
  const fieldRects: Record<RecordField, React.RefObject<{ y: number; height: number }>> = {
    spot: useRef({ y: 0, height: 0 }),
    image: useRef({ y: 0, height: 0 }),
  };
  const viewportHeight = useRef(0);
  const scrollOffset = useRef(0);
  const isSavingRef = useRef(false);

  const [showDatePicker, setShowDatePicker] = useState(false);
  /**
   * 保存中の覆いをどこから敷くか。ヘッダーは覆わない（Issue #190）。
   *
   * 高さではなく下端を持つ。絶対配置の基準は SafeAreaView の外枠で、
   * セーフエリアの余白はその内側にある。高さだけだとステータスバーのぶん
   * 足りず、覆いがヘッダーに乗る（実測: y=59 / height=65）
   */
  const [headerBottom, setHeaderBottom] = useState(0);
  /** 一部だけ保存できたときの知らせ。全部成功なら完了画面へ行くので出番はない */
  const [partialNotice, setPartialNotice] = useState<string | null>(null);

  /** 要素の下端が画面に入る分だけ動かす。最上部に持ち上げると上のものが消える */
  const reveal = (rect: { y: number; height: number }) => {
    const target = scrollTargetToReveal({
      blockY: rect.y,
      blockHeight: rect.height,
      viewportHeight: viewportHeight.current,
      currentOffset: scrollOffset.current,
      margin: spacing.lg,
    });
    if (target !== null) scrollViewRef.current?.scrollTo({ y: target, animated: true });
  };
  const revealMemo = () => reveal(memoRect.current);

  /** 欠けている欄を画面に入れる。reveal と違い、上にも戻す */
  const showField = (field: RecordField) => {
    const rect = fieldRects[field].current;
    const target = scrollTargetToShow({
      blockY: rect.y,
      blockHeight: rect.height,
      viewportHeight: viewportHeight.current,
      currentOffset: scrollOffset.current,
      margin: spacing.lg,
    });
    if (target !== null) scrollViewRef.current?.scrollTo({ y: target, animated: true });
  };

  const formattedDate = `${form.visitedAt.getFullYear()}年${form.visitedAt.getMonth() + 1}月${form.visitedAt.getDate()}日`;
  // 紙の御朱印は和暦で書かれている。ピッカーは西暦なので、照合できるよう併記する（監査 A-2）
  const eraDate = formatJapaneseEraDate(toLocalDateString(form.visitedAt));

  // 確認モーダルは廃止した（D-3）。モーダルが出していたのはスポット名と訪問日だけで
  // どちらも直前のフォーム上に見えており、一番間違えやすい写真は確認していなかった。
  // 誤登録は記録完了画面の「記録を取り消す」で回復する
  const handleSavePress = async () => {
    // ⚠️ isSubmitting は submit() の中で初めて true になるため、その手前の
    // fetchVisitedSpotIds を待っている間はボタンの disabled が効かない。
    // 確認モーダルが二度押しを吸収していたぶん、ここを塞がないと
    // 素早い二度押しで御朱印が2件・画像も2枚できてしまう
    if (isSavingRef.current) return;

    // 記録ボタンは画面下に固定されているので、下までスクロールしたまま押せる。
    // エラーの出た欄が画面の外だと、押しても何も起きていないように見える
    const invalid = form.validate();
    if (invalid.length > 0) {
      // 日付ピッカーの枠は onLayout で自分を画面に入れ直す。エラー文が増えると
      // 枠の位置が動いて onLayout が再発火し、いま指定したスクロールを上書きする。
      // 直す欄へ連れていくのが先なので、開きっぱなしのピッカーは閉じる
      setShowDatePicker(false);
      showField(invalid[0]);
      return;
    }

    // 覆いがキーボードの下に潜らないように。メモを書いている途中で押される
    Keyboard.dismiss();

    isSavingRef.current = true;
    setPartialNotice(null);
    try {
      await save();
    } finally {
      isSavingRef.current = false;
    }
  };

  const save = async () => {
    // 失敗しているのは表示用の前取得であって記録ではない。ここで中断すると
    // 「写真は撮れたのに保存されない」になるので、取得の成否によらず submit する（Issue #133 / D-2）
    let visitedSpotIds: Set<string> | null = null;
    try {
      visitedSpotIds = await fetchVisitedSpotIds();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[record] fetchVisitedSpotIds failed: ${message}`);
    }

    /*
     * 完了画面の地図に渡す、県ごとの枚数。**保存する前**に取っておく。
     * 完了画面が開いてから取りに行くと、祝っている最中に地図の色が後から変わる。
     * ここも表示用なので、失敗しても記録は止めない（Issue #133 と同じ扱い）
     */
    let regionStats: RegionStat[] | null = null;
    let visitLog: { spot_id: string; visited_at: string }[] | null = null;
    if (user) {
      try {
        [regionStats, visitLog] = await Promise.all([
          fetchRegionStats(user.id),
          fetchVisitLog(user.id),
        ]);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`[record] fetchRegionStats failed: ${message}`);
      }
    }

    const result = await form.submit();

    // 1枚も残らなかったときだけ従来どおりエラー画面へ。
    // 1枚でも保存できていれば、それは有効な記録なので画面ごと捨てない
    if (result.stamps.length === 0) {
      if (result.failedCount > 0) {
        const errorType = isNetworkError(result.error) ? 'network' : 'upload';
        navigation.navigate('Error', {
          type: errorType,
          origin: 'record',
          stage: result.stage,
          message: result.message,
        });
      }
      return;
    }

    // 一部だけ失敗。保存できた分はフォームから外れているので、
    // そのまま「記録する」を押せば残りだけをやり直せる
    if (result.failedCount > 0) {
      setPartialNotice(
        `${result.stamps.length + result.failedCount}枚のうち${result.stamps.length}枚を記録しました。` +
          `残り${result.failedCount}枚をもう一度お試しください`
      );
      return;
    }

    const completeParams = {
      stampImageUrl: getStampImageUrl(result.stamps[0].image_path),
      stampCount: result.stamps.length,
      spotName: form.selectedSpot?.name,
      spotType: form.selectedSpot?.type,
      visitedAt: toLocalDateString(form.visitedAt),
      // 完了画面は来た場所に返す
      origin: route.params?.origin,
      ...buildMapParams(regionStats, form.selectedSpot?.prefecture, result.stamps.length),
    };

    // previousCount が無い以上バッジは判定できない。0 を代入して評価すると
    // 「100箇所目なのに1箇所目」と祝い、獲得済みバッジが再発火する（Issue #133）
    if (visitedSpotIds === null) {
      navigation.replace('RecordComplete', { ...completeParams, countUnavailable: true });
      return;
    }

    /*
     * 記録した前後でバッジの条件を見比べる。**複数返る**ことがある
     * （満願と「1日に3箇所」が同じ日に揃うなど）
     */
    const today = toLocalDateString(form.visitedAt);
    const before = buildBadgeProgress(visitLog ?? [], today);
    const after = buildBadgeProgress(
      [
        ...(visitLog ?? []),
        ...result.stamps.map(() => ({
          spot_id: form.selectedSpot?.id ?? '',
          visited_at: today,
        })),
      ],
      today
    );
    const badges = evaluateNewBadges(before, after);

    // push ではなく置き換える。記録済みのフォームを履歴に残すと、完了画面の
    // 「もう1枚記録する」から戻ったとき ✕ が完了画面へ帰ってしまい、しかも
    // 押すたびに履歴が2つずつ伸びる（Issue #188）
    navigation.replace('RecordComplete', { ...completeParams, badges });
  };

  const remainingSlots = MAX_PHOTOS_PER_RECORD - form.imageUris.length;

  const handleTakePhoto = async () => {
    const uri = await takePhoto();
    if (uri) form.addImages([uri]);
  };

  const handlePickFromLibrary = async () => {
    // selectionLimit: 0 は expo-image-picker では「無制限」の意味になる。
    // 残り0枚で呼ぶと上限が外れるので、リンク自体を出さない
    const uris = await pickFromLibrary(remainingSlots);
    if (uris.length > 0) form.addImages(uris);
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
      <View
        onLayout={e => {
          const { y, height } = e.nativeEvent.layout;
          setHeaderBottom(y + height);
        }}
        testID="header-block"
      >
        <Header title="御朱印を記録" variant="modal" onClose={() => navigation.goBack()} />
      </View>

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
          onLayout={e => {
            viewportHeight.current = e.nativeEvent.layout.height;
          }}
          onScroll={e => {
            scrollOffset.current = e.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={16}
          testID="record-scroll"
        >
          <Text style={styles.sectionLabel}>スポット</Text>
          <View
            onLayout={e => {
              fieldRects.spot.current = e.nativeEvent.layout;
            }}
            testID="spot-block"
          >
            <SpotSelector
              selectedSpot={form.selectedSpot}
              nearbySpots={filteredSpots}
              searchQuery={searchQuery}
              onSearchQueryChange={setSearchQuery}
              onSelectSpot={form.selectSpot}
              error={form.spotError}
              isAutoSelected={form.isSpotAutoSelected}
              didYouMeanSpots={didYouMeanSpots}
              showDistance={granted}
              onResearch={handleResearch}
            />
          </View>

          <Text style={styles.sectionLabel}>御朱印の写真</Text>
          {/* 写真枠のタップでカメラを直接起動する。選択モーダルを1タップ挟んでいた分を削った。
              ギャラリーは使用頻度が低いので、常時見えるリンクとして枠の下に残す */}
          <View
            onLayout={e => {
              fieldRects.image.current = e.nativeEvent.layout;
            }}
            testID="photo-block"
          >
            <PhotoSection
              imageUris={form.imageUris}
              onAddPress={handleTakePhoto}
              onRemove={form.removeImage}
              error={form.imageError}
            />
          </View>
          {remainingSlots > 0 && (
            <TouchableOpacity
              style={styles.libraryLink}
              onPress={handlePickFromLibrary}
              testID="pick-from-library"
            >
              <Text style={styles.libraryLinkText}>ギャラリーから選ぶ</Text>
            </TouchableOpacity>
          )}

          <Text style={styles.sectionLabel}>訪問日</Text>
          <TouchableOpacity
            style={styles.dateRow}
            onPress={() => setShowDatePicker(true)}
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
            <View
              // 高さが確定してから動かす。行を最上部に持ち上げると、上にある
              // 御朱印の写真が画面外に出て、日付を見ながら決められない
              onLayout={e => reveal(e.nativeEvent.layout)}
              testID="date-picker-block"
            >
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
              memoRect.current = e.nativeEvent.layout;
            }}
            testID="memo-block"
          >
            <TextInput
              style={styles.memoInput}
              placeholder="メモを入力..."
              placeholderTextColor={colors.gray[400]}
              multiline
              value={form.memo}
              onChangeText={form.setMemo}
              // キーボードが出てから測りたいので、ここは待つ必要がある
              onFocus={() => setTimeout(() => revealMemo(), 300)}
              testID="memo-input"
            />
          </View>

          <Text style={styles.memoGuide}>
            駐車場の有無、アクセス情報などを書くと、{'\n'}
            スポット情報として自動的に反映されます
          </Text>

          {/* Guideline 1.2（UGC）対応で公開トグルを外した（Issue #147）。
              createStamp の `is_public: params.isPublic ?? false` により、
              トグルが無ければ新規記録は必ず非公開になる。
              v1.1 で通報・ブロック・EULA を実装したらここに戻す */}
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.footer}>
        {partialNotice && (
          <Text style={styles.partialNotice} testID="partial-notice">
            {partialNotice}
          </Text>
        )}
        <Button
          title="この内容で記録する"
          onPress={handleSavePress}
          variant="primary"
          disabled={form.isSubmitting}
        />
      </View>

      {/* 覆いの仕事は演出だけではない。これが無いと保存中にスポットを選び直したり
          写真を消したりできてしまう。ただしヘッダーは覆わない: アップロードに
          タイムアウトが無いので、✕ を塞ぐと回線が死んだとき逃げ道が消える */}
      <SavingOverlay
        visible={form.isSubmitting}
        total={form.imageUris.length}
        saved={form.savedCount}
        top={headerBottom}
      />

      <SpotResearchSheet
        state={spotAdd.state}
        userLocation={granted ? location : null}
        recentPrefectures={recentPrefectures}
        onClose={spotAdd.close}
        onPick={spotAdd.pick}
        onRetry={spotAdd.retry}
        onChoose={spotAdd.choose}
        onOpenManual={spotAdd.openManual}
      />
      <SpotPlacePicker
        visible={spotAdd.state.placing}
        initialName={spotAdd.state.name}
        initialCenter={(granted && location) || DEFAULT_LOCATION}
        saving={spotAdd.state.status === 'saving'}
        saveFailed={spotAdd.state.saveFailed}
        onBack={spotAdd.close}
        onSave={spotAdd.saveManual}
      />
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
  libraryLink: {
    alignSelf: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xs,
  },
  libraryLinkText: {
    ...typography.caption,
    color: colors.primary[500],
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
  partialNotice: {
    ...typography.caption,
    color: colors.error,
    marginBottom: spacing.sm,
  },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.gray[200],
    backgroundColor: colors.white,
  },
});
