import React, { useEffect, useRef, useState } from 'react';
import { Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { NativeSyntheticEvent } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Camera, Map } from '@maplibre/maplibre-react-native';
import type { ViewStateChangeEvent } from '@maplibre/maplibre-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@components/common/Button';
import { Header } from '@components/common/Header';
import { MAP_STYLE } from '@components/map/mapStyle';
import type { SpotType } from '@/types/supabase';
import { guessTypeFromName } from '@utils/spotName';
import { colors } from '@theme/colors';
import { typography } from '@theme/typography';
import { spacing, borderRadius } from '@theme/spacing';

const PICKER_ZOOM = 16;

interface Props {
  visible: boolean;
  initialName: string;
  /** 地図の最初の中心（位置情報が許可されていれば端末の位置、されていなければ既定の位置） */
  initialCenter: { latitude: number; longitude: number };
  saving: boolean;
  saveFailed: boolean;
  onBack: () => void;
  onSave: (spot: { name: string; type: SpotType; lat: number; lng: number }) => void;
}

/**
 * 地図で場所を決める（Issue #248 の ④）。地図を動かして、画面の中心のピンを寺社に合わせる。
 * 送るのは**地図の中心**（寺社の位置として決めたもの）で、端末の位置ではない（D-9）
 */
export function SpotPlacePicker({
  visible,
  initialName,
  initialCenter,
  saving,
  saveFailed,
  onBack,
  onSave,
}: Props) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(initialName);
  const [type, setType] = useState<SpotType>(guessTypeFromName(initialName));
  const center = useRef({ lat: initialCenter.latitude, lng: initialCenter.longitude });

  useEffect(() => {
    if (!visible) return;
    setName(initialName);
    setType(guessTypeFromName(initialName));
    center.current = { lat: initialCenter.latitude, lng: initialCenter.longitude };
    // 開いたときの値で始める（開いている間に位置が更新されてもピンを動かさない）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const handleRegionDidChange = (e: NativeSyntheticEvent<ViewStateChangeEvent>) => {
    const [lng, lat] = e.nativeEvent.center;
    center.current = { lat, lng };
  };

  const trimmed = name.trim();

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onBack}>
      <View style={[styles.root, { paddingTop: insets.top }]} testID="spot-place-picker">
        <Header title="場所を決める" onBack={onBack} />
        <View style={styles.mapArea}>
          <Map
            style={StyleSheet.absoluteFill}
            mapStyle={MAP_STYLE}
            logo={false}
            compass={false}
            onRegionDidChange={handleRegionDidChange}
            testID="place-picker-map"
          >
            <Camera
              initialViewState={{
                center: [initialCenter.longitude, initialCenter.latitude],
                zoom: PICKER_ZOOM,
              }}
            />
          </Map>
          <View style={styles.pinLayer} pointerEvents="none">
            <MaterialIcons name="place" size={44} color={colors.primary[500]} />
          </View>
          <View style={styles.tip} pointerEvents="none">
            <Text style={styles.tipText}>地図を動かして、ピンを寺社の場所に合わせてください</Text>
          </View>
        </View>

        <View style={[styles.form, { paddingBottom: insets.bottom + spacing.lg }]}>
          <Text style={styles.label}>名前</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            style={styles.input}
            placeholder="寺社の名前"
            placeholderTextColor={colors.gray[400]}
            testID="place-picker-name"
          />
          <View style={styles.typeRow}>
            {(['shrine', 'temple'] as const).map(t => {
              const on = type === t;
              return (
                <TouchableOpacity
                  key={t}
                  style={[
                    styles.typeButton,
                    on && (t === 'shrine' ? styles.shrineOn : styles.templeOn),
                  ]}
                  onPress={() => setType(t)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  testID={`place-picker-type-${t}`}
                >
                  <Text
                    style={[
                      styles.typeText,
                      on && { color: t === 'shrine' ? colors.shrine[600] : colors.temple[600] },
                    ]}
                  >
                    {t === 'shrine' ? '神社' : '寺院'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {saveFailed && (
            <Text style={styles.saveError}>追加できませんでした。もう一度お試しください</Text>
          )}
          <View style={styles.gap} />
          <Button
            title={saving ? '記録しています…' : 'この場所で記録する'}
            onPress={() => onSave({ name: trimmed, type, ...center.current })}
            disabled={!trimmed || saving}
            testID="place-picker-save"
          />
          <Text style={styles.note}>この寺社は、あなたの記録にだけ出ます</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  mapArea: { flex: 1, backgroundColor: colors.gray[100] },
  pinLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    // ピンの先を地図の中心に合わせる（アイコンの高さの分だけ上げる）
    paddingBottom: 44,
  },
  tip: {
    position: 'absolute',
    top: spacing.md,
    alignSelf: 'center',
    backgroundColor: colors.gray[800],
    borderRadius: borderRadius.full,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  tipText: { ...typography.caption, color: colors.white },
  form: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    backgroundColor: colors.white,
  },
  label: { ...typography.label, color: colors.gray[600], marginBottom: spacing.xs },
  input: {
    ...typography.body,
    color: colors.gray[900],
    borderWidth: 1,
    borderColor: colors.gray[200],
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  typeRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  typeButton: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.gray[200],
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  shrineOn: { borderColor: colors.shrine[500], backgroundColor: colors.shrine[50] },
  templeOn: { borderColor: colors.temple[500], backgroundColor: colors.temple[50] },
  typeText: { ...typography.body, fontWeight: '700', color: colors.gray[600] },
  gap: { height: spacing.md },
  saveError: {
    ...typography.caption,
    color: colors.error,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  note: {
    ...typography.caption,
    color: colors.gray[500],
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
